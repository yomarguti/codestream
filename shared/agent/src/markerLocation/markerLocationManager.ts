"use strict";
import { structuredPatch } from "diff";
import * as path from "path";
import { TextDocumentIdentifier } from "vscode-languageserver";
import { Range } from "vscode-languageserver-protocol";
import URI from "vscode-uri";
import {
	CSFileStream,
	CSLocationArray,
	CSMarker,
	CSMarkerLocation,
	CSMarkerLocations
} from "../api/api";
import { getCache } from "../cache";
import { Container } from "../container";
import { GitRepository } from "../git/models/repository";
import { Logger } from "../logger";
import { MarkerManager } from "../marker/markerManager";
import { StreamManager } from "../stream/streamManager";
import { xfs } from "../xfs";
import { calculateLocation, calculateLocations } from "./calculator";

export interface LocationsById {
	[id: string]: CSMarkerLocation;
}

interface ArraysById {
	[id: string]: CSLocationArray;
}

interface UncommittedLocation {
	fileContents: string;
	location: CSMarkerLocation;
}

interface UncommittedLocationsById {
	[id: string]: UncommittedLocation;
}

export class MarkerLocationManager {
	private static streamsCache: {
		[streamId: string]: {
			[commitHash: string]: {
				[markerId: string]: CSMarkerLocation;
			};
		};
	} = {};

	static async getCurrentLocations(documentUri: string): Promise<LocationsById> {
		const { documents, git } = Container.instance();

		const currentLocations: LocationsById = {};
		const filePath = URI.parse(documentUri).fsPath;
		const repoRoot = await git.getRepoRoot(filePath);
		const currentCommitHash = await git.getFileCurrentRevision(filePath);
		if (!repoRoot || !currentCommitHash) {
			Logger.log(`MARKERS: no repo root or no current commit hash for ${filePath}`);
			return currentLocations;
		}

		const currentCommitLocations = await MarkerLocationManager.getCommitLocations(
			filePath,
			currentCommitHash
		);
		if (!Object.keys(currentCommitLocations).length) {
			Logger.log(`MARKERS: no locations found for ${filePath}@${currentCommitHash}`);
			return currentLocations;
		}

		Logger.log(`MARKERS: classifying locations`);
		const {
			committedLocations,
			uncommittedLocations
		} = await MarkerLocationManager.classifyLocations(repoRoot, currentCommitLocations);
		const doc = documents.get(documentUri);
		Logger.log(`MARKERS: retrieving current text from document manager`);
		let currentBufferText = doc && doc.getText();
		if (currentBufferText == null) {
			Logger.log(`MARKERS: current text not found in document manager - reading from disk`);
			currentBufferText = await xfs.readText(filePath);
		}
		if (!currentBufferText) {
			throw new Error(`Could not retrieve contents for ${filePath}`);
		}

		const result: LocationsById = {};

		if (Object.keys(committedLocations).length) {
			Logger.log(`MARKERS: calculating current location for committed locations`);
			const currentCommitText = await git.getFileContentForRevision(filePath, currentCommitHash);
			if (currentCommitText === undefined) {
				throw new Error(`Could not retrieve contents for ${filePath}@${currentCommitHash}`);
			}
			const diff = structuredPatch(
				filePath,
				filePath,
				currentCommitText,
				currentBufferText,
				"",
				""
			);
			const calculatedLocations = await calculateLocations(committedLocations, diff);
			for (const id in committedLocations) {
				const commLoc = committedLocations[id];
				const currLoc = calculatedLocations[id];
				Logger.log(
					`MARKERS: ${id} [${commLoc.lineStart}, ${commLoc.colStart}, ${commLoc.lineEnd}, ${
						commLoc.colEnd
					}] => [${currLoc.lineStart}, ${currLoc.colStart}, ${currLoc.lineEnd}, ${currLoc.colEnd}]`
				);
			}
			Object.assign(result, calculatedLocations);
		}

		if (Object.keys(uncommittedLocations).length) {
			Logger.log(`MARKERS: calculating current location for uncommitted locations`);
			for (const id in uncommittedLocations) {
				const uncommittedLocation = uncommittedLocations[id];
				const uncommittedBufferText = uncommittedLocation.fileContents;
				const diff = structuredPatch(
					filePath,
					filePath,
					uncommittedBufferText,
					currentBufferText,
					"",
					""
				);
				const currLoc = (await calculateLocation(uncommittedLocation.location, diff)) || {};
				result[id] = currLoc;

				const uncommLoc = uncommittedLocation.location || {};

				Logger.log(
					`MARKERS: ${id} [${uncommLoc.lineStart}, ${uncommLoc.colStart}, ${uncommLoc.lineEnd}, ${
						uncommLoc.colEnd
					}] => [${currLoc.lineStart}, ${currLoc.colStart}, ${currLoc.lineEnd}, ${currLoc.colEnd}]`
				);
			}
		}

		return result;
	}

	private static async classifyLocations(
		repoPath: string,
		locations: LocationsById
	): Promise<{
		committedLocations: LocationsById;
		uncommittedLocations: UncommittedLocationsById;
	}> {
		const result = {
			committedLocations: {} as LocationsById,
			uncommittedLocations: {} as UncommittedLocationsById
		};
		Logger.log(`MARKERS: retrieving uncommitted locations from local cache`);
		const cache = await getCache(repoPath);
		const cachedUncommittedLocations = cache.getCollection("uncommittedLocations");
		for (const id in locations) {
			const location = locations[id];
			const uncommittedLocation = cachedUncommittedLocations.get(location.id);
			if (uncommittedLocation) {
				Logger.log(`MARKERS: ${id}: uncommitted`);
				result.uncommittedLocations[id] = uncommittedLocation;
			} else {
				Logger.log(`MARKERS: ${id}: committed`);
				result.committedLocations[id] = location;
			}
		}

		return result;
	}

	static async backtrackLocation(
		documentId: TextDocumentIdentifier,
		text: string,
		location: CSMarkerLocation
	): Promise<CSMarkerLocation> {
		const { documents, git } = Container.instance();
		const documentUri = documentId.uri;
		const filePath = URI.parse(documentUri).fsPath;

		const fileCurrentRevision = await git.getFileCurrentRevision(filePath);
		if (!fileCurrentRevision) {
			// TODO marcelo - must signal
			return location;
			// return deletedLocation(location);
		}

		const currentCommitText = await git.getFileContentForRevision(filePath, fileCurrentRevision);
		if (currentCommitText === undefined) {
			throw new Error(`Could not retrieve contents for ${filePath}@${fileCurrentRevision}`);
		}

		const doc = documents.get(documentUri);
		if (!doc) {
			throw new Error(`Could not retrieve ${documentUri} from document manager`);
		}
		// Maybe in this case the IDE should inform the buffer contents to ensure we have the exact same
		// buffer text the user is seeing
		const diff = structuredPatch(filePath, filePath, text, currentCommitText, "", "");
		return calculateLocation(location, diff);
	}

	static async getCommitLocations(filePath: string, commitHash: string): Promise<LocationsById> {
		const { git, api, session } = Container.instance();

		Logger.log(`MARKERS: getting locations for ${filePath}@${commitHash}`);
		const streamId = await StreamManager.getStreamId(filePath);
		if (!streamId) {
			Logger.log(`MARKERS: cannot find streamId for ${filePath}`);
			return {};
		}

		const markersById = await MarkerManager.getMarkersForStream(streamId);
		const markers = Array.from(markersById.values());
		Logger.log(`MARKERS: found ${markers.length} markers for stream ${streamId}`);

		const currentCommitLocations = await MarkerLocationManager.getMarkerLocations(
			streamId,
			commitHash
		);
		const missingMarkersByCommit = MarkerLocationManager.getMissingMarkersByCommit(
			markers,
			currentCommitLocations
		);

		if (missingMarkersByCommit.size === 0) {
			Logger.log(`MARKERS: no missing locations`);
		} else {
			Logger.log(`MARKERS: missing locations detected - will calculate`);
		}

		for (const entry of missingMarkersByCommit.entries()) {
			const commitHashWhenCreated = entry[0];
			const missingMarkers = entry[1];
			Logger.log(
				`MARKERS: Getting original locations for ${
					missingMarkers.length
				} markers created at ${commitHashWhenCreated}`
			);

			const allCommitLocations = await MarkerLocationManager.getMarkerLocations(
				streamId,
				commitHashWhenCreated
			);
			const locationsToCalculate: LocationsById = {};
			for (const marker of missingMarkers) {
				locationsToCalculate[marker.id] = allCommitLocations[marker.id];
			}

			Logger.log(`MARKERS: diffing ${filePath} from ${commitHashWhenCreated} to ${commitHash}`);
			const diff = await git.getDiffBetweenCommits(commitHashWhenCreated, commitHash, filePath);
			Logger.log(`MARKERS: calculating locations`);
			const calculatedLocations = await calculateLocations(locationsToCalculate, diff);
			for (const id in calculatedLocations) {
				const origLoc = locationsToCalculate[id] || {};
				const currLoc = calculatedLocations[id] || {};
				Logger.log(
					`MARKERS: ${id} [${origLoc.lineStart}, ${origLoc.colStart}, ${origLoc.lineEnd}, ${
						origLoc.colEnd
					}] => [${currLoc.lineStart}, ${currLoc.colStart}, ${currLoc.lineEnd}, ${currLoc.colEnd}]`
				);
				currentCommitLocations[id] = calculatedLocations[id];
			}

			Logger.log(
				`MARKERS: saving ${
					Object.keys(calculatedLocations).length
				} calculated locations to API server`
			);
			await api.createMarkerLocation(session.apiToken, {
				teamId: session.teamId,
				streamId,
				commitHash,
				locations: MarkerLocationManager.arraysById(calculatedLocations)
			});
		}

		return currentCommitLocations;
	}

	private static arraysById(locations: LocationsById): ArraysById {
		const result: ArraysById = {};
		for (const id in locations) {
			result[id] = MarkerLocationManager.locationToArray(locations[id]);
		}
		return result;
	}

	static async cacheMarkerLocations(markerLocations: CSMarkerLocations) {
		const { streamId, commitHash, locations } = markerLocations;
		const locationsCache = await MarkerLocationManager.getMarkerLocations(streamId, commitHash);
		for (const id in locations) {
			const locationArray = locations[id];
			locationsCache[id] = MarkerLocationManager.arrayToLocation(id, locationArray);
		}
	}

	static async saveUncommittedLocation(
		filePath: string,
		fileContents: string,
		location: CSMarkerLocation
	) {
		Logger.log(`MARKERS: saving uncommitted marker location ${location.id} to local cache`);
		const { git } = Container.instance();
		const repoRoot = await git.getRepoRoot(filePath);

		if (!repoRoot) {
			throw new Error(`Could not find repo root for ${filePath}`);
		}

		const cache = await getCache(repoRoot);
		const uncommittedLocations = cache.getCollection("uncommittedLocations");
		uncommittedLocations.set(location.id, {
			fileContents,
			location
		} as UncommittedLocation);
		Logger.log(`MARKERS: flushing local cache`);
		await cache.flush();
		Logger.log(`MARKERS: local cache flushed`);
	}

	static async flushUncommittedLocations(repo: GitRepository) {
		Logger.log(`MARKERS: flushing uncommitted locations`);
		const { api, git, session } = Container.instance();
		const cache = await getCache(repo.path);
		const uncommittedLocations = cache.getCollection("uncommittedLocations");
		for (const id of uncommittedLocations.keys()) {
			Logger.log(`MARKERS: checking uncommitted marker ${id}`);
			const marker = await MarkerManager.getMarker(id);
			const stream = (await StreamManager.getStream(marker.streamId)) as CSFileStream;
			const uncommittedLocation = uncommittedLocations.get(id) as UncommittedLocation;
			const originalContents = uncommittedLocation.fileContents;
			const relPath = stream.file;
			const absPath = path.join(repo.path, relPath);
			const commitHash = await git.getFileCurrentRevision(absPath);
			if (!commitHash) {
				Logger.log(`MARKERS: file ${relPath} is not committed yet - skipping`);
				continue;
			}
			const commitContents = await git.getFileContentForRevision(absPath, commitHash);
			if (!commitContents) {
				Logger.log(`MARKERS: file ${relPath} has no contents on revision ${commitHash} - skipping`);
				continue;
			}
			const diff = structuredPatch(relPath, relPath, originalContents, commitContents, "", "");
			const location = await calculateLocation(uncommittedLocation.location, diff);
			if (location.meta && location.meta.entirelyDeleted) {
				Logger.log(`MARKERS: location is not present on commit ${commitHash} - skipping`);
				continue;
			}
			const locationArraysById = {} as {
				[id: string]: CSLocationArray;
			};
			locationArraysById[id] = this.locationToArray(location);
			Logger.log(
				`MARKERS: committed ${id}@${commitHash} => [${location.lineStart}, ${location.colStart}, ${
					location.lineEnd
				}, ${location.colEnd}] - saving to API server`
			);
			await api.createMarkerLocation(session.apiToken, {
				teamId: session.teamId,
				streamId: stream.id,
				commitHash,
				locations: locationArraysById
			});
			Logger.log(`MARKERS: updating marker => commitHashWhenCreated:${commitHash}`);
			await api.updateMarker(session.apiToken, id, {
				commitHashWhenCreated: commitHash
			});
			uncommittedLocations.delete(id);
			Logger.log(`MARKERS: flushing local cache`);
			await cache.flush();
			Logger.log(`MARKERS: local cache flushed`);
		}
	}

	static async getMarkerLocations(streamId: string, commitHash: string): Promise<LocationsById> {
		const { api, state } = Container.instance();
		const commitsCache =
			MarkerLocationManager.streamsCache[streamId] ||
			(MarkerLocationManager.streamsCache[streamId] = {});
		let locationsCache = commitsCache[commitHash];

		if (!locationsCache) {
			Logger.log(
				`MARKERS: no cached locations for stream ${streamId} and commit hash ${commitHash} - fetching from API server`
			);
			const response = await api.getMarkerLocations(
				state.apiToken,
				state.teamId,
				streamId,
				commitHash
			);
			locationsCache = commitsCache[commitHash] = {};
			const locations = response.markerLocations.locations || {};

			for (const id in locations) {
				const array = locations[id];
				locationsCache[id] = MarkerLocationManager.arrayToLocation(id, array);
			}
		} else {
			Logger.log(
				`MARKERS: found cached locations for stream ${streamId} and commit hash ${commitHash}`
			);
		}

		return locationsCache;
	}

	static getMissingMarkersByCommit(markers: CSMarker[], locations: LocationsById) {
		const missingMarkerIds = MarkerLocationManager.getMissingMarkerIds(markers, locations);

		const missingMarkersByCommitHashWhenCreated = new Map<string, CSMarker[]>();
		for (const m of markers) {
			if (!missingMarkerIds.has(m.id)) {
				continue;
			}

			let markersForCommitHash = missingMarkersByCommitHashWhenCreated.get(m.commitHashWhenCreated);
			if (!markersForCommitHash) {
				markersForCommitHash = [];
				missingMarkersByCommitHashWhenCreated.set(m.commitHashWhenCreated, markersForCommitHash);
			}
			Logger.log(`Missing location for marker ${m.id} - will calculate`);
			markersForCommitHash.push(m);
		}
		return missingMarkersByCommitHashWhenCreated;
	}

	static getMissingMarkerIds(markers: CSMarker[], locations: { [p: string]: any }): Set<string> {
		const missingMarkerIds = new Set<string>();
		for (const m of markers) {
			if (!locations[m.id]) {
				missingMarkerIds.add(m.id);
			}
		}
		return missingMarkerIds;
	}

	static arrayToLocation(id: string, array: CSLocationArray): CSMarkerLocation {
		return {
			id,
			lineStart: array[0],
			colStart: array[1],
			lineEnd: array[2],
			colEnd: array[3]
		};
	}

	static locationToRange(location: CSMarkerLocation): Range {
		return Range.create(
			Math.max(location.lineStart - 1, 0),
			Math.max(location.colStart - 1, 0),
			Math.max(location.lineEnd - 1, 0),
			Math.max(location.colEnd - 1, 0)
		);
	}

	static rangeToLocation(range: Range): CSMarkerLocation {
		return {
			id: "$transientLocation",
			lineStart: range.start.line + 1,
			colStart: range.start.character + 1,
			lineEnd: range.end.line + 1,
			colEnd: range.end.character + 1
		};
	}

	static locationToArray(location: CSMarkerLocation): CSLocationArray {
		return [
			location.lineStart,
			location.colStart,
			location.lineEnd,
			location.colEnd,
			location.meta
		];
	}

	static emptyFileLocation(): CSMarkerLocation {
		return {
			id: "$transientLocation",
			lineStart: 1,
			colStart: 1,
			lineEnd: 1,
			colEnd: 1,
			meta: {
				startWasDeleted: true,
				endWasDeleted: true,
				entirelyDeleted: true
			}
		};
	}
}
