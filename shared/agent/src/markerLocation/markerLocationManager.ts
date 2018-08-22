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
			return currentLocations;
		}

		const currentCommitLocations = await MarkerLocationManager.getCommitLocations(
			filePath,
			currentCommitHash
		);
		if (!Object.keys(currentCommitLocations).length) {
			return currentLocations;
		}

		const {
			committedLocations,
			uncommittedLocations
		} = await MarkerLocationManager.classifyLocations(repoRoot, currentCommitLocations);
		const doc = documents.get(documentUri);
		let currentBufferText = doc && doc.getText();
		if (currentBufferText == null) {
			currentBufferText = await xfs.readText(filePath);
		}
		if (!currentBufferText) {
			throw new Error(`Could not retrieve contents for ${filePath}`);
		}

		const result: LocationsById = {};

		if (Object.keys(committedLocations).length) {
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
			Object.assign(result, await calculateLocations(committedLocations, diff));
		}

		if (Object.keys(uncommittedLocations).length) {
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
				result[id] = await calculateLocation(uncommittedLocation.location, diff);
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
		const cache = await getCache(repoPath);
		const cachedUncommittedLocations = cache.getCollection("uncommittedLocations");
		for (const id in locations) {
			const location = locations[id];
			const uncommittedLocation = cachedUncommittedLocations.get(location.id);
			if (uncommittedLocation) {
				result.uncommittedLocations[id] = uncommittedLocation;
			} else {
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

		const streamId = await StreamManager.getStreamId(filePath);
		if (!streamId) {
			return {};
		}

		const markersById = await MarkerManager.getMarkersForStream(streamId);
		const markers = Array.from(markersById.values());

		const currentCommitLocations = await MarkerLocationManager.getMarkerLocations(
			streamId,
			commitHash
		);
		const missingMarkersByCommit = MarkerLocationManager.getMissingMarkersByCommit(
			markers,
			currentCommitLocations
		);

		for (const entry of missingMarkersByCommit.entries()) {
			const commitHashWhenCreated = entry[0];
			const missingMarkers = entry[1];

			const allCommitLocations = await MarkerLocationManager.getMarkerLocations(
				streamId,
				commitHashWhenCreated
			);
			const locationsToCalculate: LocationsById = {};
			for (const marker of missingMarkers) {
				locationsToCalculate[marker.id] = allCommitLocations[marker.id];
			}

			const diff = await git.getDiffBetweenCommits(commitHashWhenCreated, commitHash, filePath);
			const calculatedLocations = await calculateLocations(locationsToCalculate, diff);
			for (const id in calculatedLocations) {
				currentCommitLocations[id] = calculatedLocations[id];
			}

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

	static async cacheMarkerLocations(markerLocations: CSMarkerLocations[]) {
		for (const markerLocation of markerLocations) {
			const { streamId, commitHash, locations } = markerLocation;
			const locationsCache = await MarkerLocationManager.getMarkerLocations(streamId, commitHash);
			for (const id in locations) {
				const locationArray = locations[id];
				locationsCache[id] = MarkerLocationManager.arrayToLocation(id, locationArray);
			}
		}
	}

	static async saveUncommittedLocation(
		filePath: string,
		fileContents: string,
		location: CSMarkerLocation
	) {
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
		await cache.flush();
	}

	static async flushUncommittedLocations(repo: GitRepository) {
		const { api, git, session } = Container.instance();
		const cache = await getCache(repo.path);
		const uncommittedLocations = cache.getCollection("uncommittedLocations");
		for (const id of uncommittedLocations.keys()) {
			const marker = await MarkerManager.getMarker(id);
			const stream = (await StreamManager.getStream(marker.streamId)) as CSFileStream;
			const uncommittedLocation = uncommittedLocations.get(id) as UncommittedLocation;
			const originalContents = uncommittedLocation.fileContents;
			const relPath = stream.file;
			const absPath = path.join(repo.path, relPath);
			const commitHash = await git.getFileCurrentRevision(absPath);
			if (!commitHash) {
				continue;
			}
			const commitContents = await git.getFileContentForRevision(absPath, commitHash);
			if (!commitContents) {
				continue;
			}
			const diff = structuredPatch(relPath, relPath, originalContents, commitContents, "", "");
			const location = await calculateLocation(uncommittedLocation.location, diff);
			if (location.meta && location.meta.entirelyDeleted) {
				continue;
			}
			const locationArraysById = {} as {
				[id: string]: CSLocationArray;
			};
			locationArraysById[id] = this.locationToArray(location);
			await api.createMarkerLocation(session.apiToken, {
				teamId: session.teamId,
				streamId: stream.id,
				commitHash,
				locations: locationArraysById
			});
			await api.updateMarker(session.apiToken, id, {
				commitHashWhenCreated: commitHash
			});
			uncommittedLocations.delete(id);
			await cache.flush();
		}
	}

	static async getMarkerLocations(streamId: string, commitHash: string): Promise<LocationsById> {
		const { api, state } = Container.instance();
		const commitsCache =
			MarkerLocationManager.streamsCache[streamId] ||
			(MarkerLocationManager.streamsCache[streamId] = {});
		let locationsCache = commitsCache[commitHash];

		if (!locationsCache) {
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
			markersForCommitHash.push(m);
		}
		return missingMarkersByCommitHashWhenCreated;
	}

	static getMissingMarkerIds(markers: CSMarker[], locations: { [p: string]: any }): Set<string> {
		const missingMarkerIds = new Set<string>();
		for (const m of markers) {
			missingMarkerIds.add(m.id);
		}
		for (const id in locations) {
			missingMarkerIds.delete(id);
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
