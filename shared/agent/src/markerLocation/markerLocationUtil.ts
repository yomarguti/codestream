"use strict";

import { Container } from "../container";
import { CSLocationArray, CSMarker, CSMarkerLocation } from "../api/types";
import { URL } from "url";
import { StreamUtil } from "../git/streamUtil";
import { MarkerUtil } from "../marker/markerUtil";
import { calculateLocations } from "./calculator";
import { structuredPatch } from "diff";

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

	export async function getCurrentLocations(documentUri: string): Promise<LocationsById> {
		const { documents, git } = Container.instance();
		const filePath = new URL(documentUri).pathname;

		const currentCommitHash = await git.getFileCurrentSha(filePath);
		if (!currentCommitHash) {
			return {};
		}
		const currentCommitLocations = await getCommitLocations(filePath, currentCommitHash);
		const currentCommitText = await git.getFileRevisionContent(filePath, currentCommitHash);
		if (currentCommitText === undefined) {
			throw new Error(`Could not retrieve contents for ${filePath}@${currentCommitHash}`);
		}

		const doc = documents.get(documentUri);
		if (!doc) {
			throw new Error(`Could not retrieve ${documentUri} from document manager`);
		}
		const currentBufferText = doc.getText();
		const diff = structuredPatch(filePath, filePath, currentCommitText, currentBufferText, "", "");
		return calculateLocations(currentCommitLocations, diff);
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

			const diff = await git.getDiff(commitHashWhenCreated, commitHash, filePath);
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

	async function getMarkerLocations(streamId: string, commitHash: string): Promise<LocationsById> {
		const { api, config } = Container.instance();
		const commitsCache = streamsCache[streamId] || (streamsCache[streamId] = {});
		let locationsCache = commitsCache[commitHash];

		if (!locationsCache) {
			const response = await api.getMarkerLocations(
				config.token,
				config.teamId,
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
			colEnd: array[3],
			meta: array[4]
		};
	}
}
