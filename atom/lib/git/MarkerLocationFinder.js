import Raven from "raven-js";
import rootLogger from "../util/Logger";

export default class MarkerLocationFinder {
	constructor({ gitRepo, accessToken, http, filePath, teamId, streamId }) {
		this._logger = rootLogger.forObject("MarkerLocationFinder", streamId);
		this._gitRepo = gitRepo;
		this._accessToken = accessToken;
		this._http = http;
		this._filePath = filePath;
		this._teamId = teamId;
		this._streamId = streamId;
	}

	async findLocationsForCurrentCommit(markers) {
		const me = this;
		const logger = me._logger;
		logger.trace(".findLocationsForCurrentCommit <=", markers);

		const filePath = me._filePath;
		const gitRepo = me._gitRepo;
		const currentCommit = await gitRepo.getCurrentCommit();
		const commitHistory = await gitRepo.getCommitHistoryForFile(filePath, 10);
		await this._addMarkersFirstCommitToCommitHistory(commitHistory, markers);

		const currentLocations = {};
		const missingMarkerIds = {};
		for (const marker of markers) {
			missingMarkerIds[marker._id] = 1;
		}

		for (const commit of commitHistory) {
			if (Object.keys(missingMarkerIds).length === 0) {
				break;
			}

			logger.debug("Getting marker locations for commit", commit);
			const locations = await this._getMarkerLocations(commit);
			const lastKnownLocations = {};

			for (const markerId of Object.keys(locations)) {
				if (missingMarkerIds[markerId]) {
					lastKnownLocations[markerId] = locations[markerId];
					delete missingMarkerIds[markerId];
				}
			}

			const lastKnownLocationsLength = Object.keys(lastKnownLocations).length;
			logger.debug(
				"Commit",
				commit,
				"has location information for",
				lastKnownLocationsLength,
				"markers"
			);
			Object.assign(currentLocations, lastKnownLocations);

			if (lastKnownLocationsLength && commit !== currentCommit) {
				const delta = await gitRepo.getDeltaBetweenCommits(commit, currentCommit, filePath);
				if (delta.edits.length) {
					logger.debug(
						"File has changed from",
						commit,
						"to",
						currentCommit,
						"- recalculating locations"
					);
					const calculatedLocations = await this._calculateLocations(
						lastKnownLocations,
						delta.edits,
						commit,
						currentCommit
					);
					Object.assign(currentLocations, calculatedLocations);
				} else {
					logger.debug("No changes in current file from", commit, "to", currentCommit);
				}
			}
		}

		return currentLocations;
	}

	async findLocationsForUncommittedChanges(currentCommitLocations, bufferText) {
		const me = this;
		const logger = me._logger;
		logger.trace(".findLocationsForUncommittedChanges <=", currentCommitLocations);

		let locations = { ...currentCommitLocations };

		const filePath = me._filePath;
		const gitRepo = me._gitRepo;
		const currentCommit = await gitRepo.getCurrentCommit();

		const unsavedDelta = await gitRepo.getDeltaForUncommittedChanges(filePath, bufferText);
		const unsavedEdits = unsavedDelta.edits;
		if (unsavedEdits.length) {
			logger.debug("File has unsaved changes - recalculating locations");
			const unsavedLocations = await this._calculateLocations(
				locations,
				unsavedEdits,
				currentCommit
			);
			locations = {
				...locations,
				...unsavedLocations
			};
		}

		return locations;
	}

	async backtrackLocationsAtCurrentCommit(dirtyLocations, bufferText) {
		const me = this;
		const logger = me._logger;
		logger.trace(".backtrackLocationsAtCurrentCommit <=", dirtyLocations);

		const filePath = me._filePath;
		const gitRepo = me._gitRepo;
		const currentCommit = await gitRepo.getCurrentCommit();

		const unsavedDelta = await gitRepo.getDeltaForUncommittedChanges(filePath, bufferText);
		const reverseEdits = me._reverseEdits(unsavedDelta.edits);

		if (reverseEdits.length) {
			logger.debug("File has unsaved changes - backtracking locations");
			const commitLocations = await this._calculateLocations(
				dirtyLocations,
				reverseEdits,
				currentCommit
			);
			return commitLocations;
		} else {
			return dirtyLocations;
		}
	}

	async _addMarkersFirstCommitToCommitHistory(commitHistory, markers) {
		const repo = this._gitRepo;
		const commitsInHistory = {};

		for (const commit of commitHistory) {
			commitsInHistory[commit] = 1;
		}

		for (const marker of markers) {
			const commitHashWhenCreated = marker.commitHashWhenCreated;
			if (!commitsInHistory[commitHashWhenCreated]) {
				const exists = await repo.ensureCommitExists(commitHashWhenCreated);
				if (exists) {
					commitHistory.push(commitHashWhenCreated);
				}
			}
		}
	}

	async _calculateLocations(locations, edits, originalCommitHash, newCommitHash) {
		try {
			const result = await this._http.put(
				"/calculate-locations?",
				{
					teamId: this._teamId,
					streamId: this._streamId,
					originalCommitHash: originalCommitHash,
					newCommitHash: newCommitHash,
					edits: edits,
					locations: locations
				},
				this._accessToken
			);
			return result.markerLocations.locations;
		} catch (error) {
			Raven.captureException(error, {
				logger: "MarkerLocationFinder._calculateLocations"
			});
			return {};
		}
	}

	_reverseEdits(edits) {
		const reversedEdits = [];

		// swap all add/del operations
		for (const edit of edits) {
			reversedEdits.push({
				delStart: edit.addStart,
				addStart: edit.delStart,
				delLength: edit.addLength,
				addLength: edit.delLength,
				dels: edit.adds,
				adds: edit.dels
			});
		}

		return reversedEdits;
	}

	async _getMarkerLocations(commitHash) {
		const { markerLocations } = await this._http.get(
			`/marker-locations?` +
				`teamId=${this._teamId}&` +
				`streamId=${this._streamId}&` +
				`commitHash=${commitHash}`,
			this._accessToken
		);
		const locations = markerLocations.locations || {};

		return locations;
	}
}
