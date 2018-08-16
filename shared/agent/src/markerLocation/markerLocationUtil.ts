"use strict";
import { structuredPatch } from "diff";
import { TextDocumentIdentifier } from "vscode-languageserver";
import { Range } from "vscode-languageserver-protocol";
import URI from "vscode-uri";
import { CSLocationArray, CSMarker, CSMarkerLocation } from "../api/api";
import { getCache } from "../cache";
import { Container } from "../container";
import { MarkerUtil } from "../marker/markerUtil";
import { StreamUtil } from "../stream/streamUtil";
import { calculateLocation, calculateLocations } from "./calculator";
import { RepoMonitor } from "./repoMonitor";

export namespace MarkerLocationUtil {
	const streamsCache: {
		[streamId: string]: {
			[commitHash: string]: {
				[markerId: string]: CSMarkerLocation;
			};
		};
	} = {};

	export interface LocationsById {
		[id: string]: CSMarkerLocation;
	}

	const monitoredRepos = new Set<string>();

	const repoMonitor = new RepoMonitor();

	export async function getCurrentLocations(documentUri: string): Promise<LocationsById> {
		const { documents, git } = Container.instance();
		const filePath = URI.parse(documentUri).fsPath;

		const currentCommitHash = await git.getFileCurrentRevision(filePath);
		if (!currentCommitHash) {
			return {};
		}
		const currentCommitLocations = await getCommitLocations(filePath, currentCommitHash);
		const currentCommitText = await git.getFileContentForRevision(filePath, currentCommitHash);
		if (currentCommitText === undefined) {
			throw new Error(`Could not retrieve contents for ${filePath}@${currentCommitHash}`);
		}

		let diff;
		const doc = documents.get(documentUri);
		if (doc) {
			const currentBufferText = doc.getText();
			diff = structuredPatch(filePath, filePath, currentCommitText, currentBufferText, "", "");
		} else {
			diff = await git.getDiffFromHead(filePath);
		}
		return calculateLocations(currentCommitLocations, diff);
	}

	export async function backtrackLocation(
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

	async function getCommitLocations(filePath: string, commitHash: string): Promise<LocationsById> {
		const { git } = Container.instance();

		const streamId = await StreamUtil.getStreamId(filePath);
		if (!streamId) {
			return {};
		}

		const markers = await MarkerUtil.getMarkers(streamId);

		const currentCommitLocations = await getMarkerLocations(streamId, commitHash);
		const missingMarkersByCommit = getMissingMarkersByCommit(markers, currentCommitLocations);

		for (const entry of missingMarkersByCommit.entries()) {
			const commitHashWhenCreated = entry[0];
			const missingMarkers = entry[1];

			const allCommitLocations = await getMarkerLocations(streamId, commitHashWhenCreated);
			const locationsToCalculate: LocationsById = {};
			for (const marker of missingMarkers) {
				locationsToCalculate[marker.id] = allCommitLocations[marker.id];
			}

			const diff = await git.getDiffBetweenCommits(commitHashWhenCreated, commitHash, filePath);
			const calculatedLocations = await calculateLocations(locationsToCalculate, diff);
			for (const id in calculatedLocations) {
				const location = calculatedLocations[id];
				await saveMarkerLocation(streamId, commitHash, location);
				currentCommitLocations[id] = location;
			}
		}

		return currentCommitLocations;
	}

	async function saveMarkerLocation(
		streamId: string,
		commitHash: string,
		location: CSMarkerLocation
	) {
		await getMarkerLocations(streamId, commitHash);
		// TODO Marcelo save it on the api server
		const commitsCache = streamsCache[streamId];
		const locationsCache = commitsCache[commitHash];
		locationsCache[location.id] = location;
	}

	export async function saveUncommittedLocation(
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
		});
		await cache.flush();
	}

	async function getMarkerLocations(streamId: string, commitHash: string): Promise<LocationsById> {
		const { api, state } = Container.instance();
		const commitsCache = streamsCache[streamId] || (streamsCache[streamId] = {});
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
				locationsCache[id] = arrayToLocation(id, array);
			}
		}

		return { ...locationsCache };
	}

	function getMissingMarkersByCommit(markers: CSMarker[], locations: LocationsById) {
		const missingMarkerIds = getMissingMarkerIds(markers, locations);

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

	function getMissingMarkerIds(markers: CSMarker[], locations: { [p: string]: any }): Set<string> {
		const missingMarkerIds = new Set<string>();
		for (const m of markers) {
			missingMarkerIds.add(m.id);
		}
		for (const id in locations) {
			missingMarkerIds.delete(id);
		}
		return missingMarkerIds;
	}

	function arrayToLocation(id: string, array: CSLocationArray): CSMarkerLocation {
		return {
			id,
			lineStart: array[0],
			colStart: array[1],
			lineEnd: array[2],
			colEnd: array[3]
		};
	}

	export function locationToRange(location: CSMarkerLocation): Range {
		return {
			start: {
				line: location.lineStart - 1,
				character: location.colStart - 1
			},
			end: {
				line: location.lineEnd - 1,
				character: location.colEnd - 1
			}
		};
	}

	export function rangeToLocation(range: Range): CSMarkerLocation {
		return {
			id: "$transientLocation",
			lineStart: range.start.line + 1,
			colStart: range.start.character + 1,
			lineEnd: range.end.line + 1,
			colEnd: range.end.character + 1
		};
	}

	export async function monitorRepo(documentUri: string) {
		const { git } = Container.instance();
		const filePath = URI.parse(documentUri).fsPath;

		const repoRoot = await git.getRepoRoot(filePath);
		if (!repoRoot) {
			return;
		}

		repoMonitor.monitor(repoRoot);
	}

	export function locationToArray(location: CSMarkerLocation): CSLocationArray {
		return [
			location.lineStart,
			location.colStart,
			location.lineEnd,
			location.colEnd,
			location.meta
		];
	}

	export function emptyFileLocation(): CSMarkerLocation {
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
