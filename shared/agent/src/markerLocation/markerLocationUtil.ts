"use strict";

import { Container } from "../container";
import { CSMarker, CSMarkerLocations } from "../api/types";
import { URL } from "url";
import { StreamUtil } from "../git/streamUtil";
import { MarkerUtil } from "../marker/markerUtil";

export namespace MarkerLocationUtil {
	export async function getCurrentLocations(
		documentUri: string
	): Promise<Map<string, CSMarkerLocations>> {
		const locationMap = new Map();

		const { documents, api, config, git } = Container.instance;
		const filePath = new URL(documentUri).pathname;
		const streamId = await StreamUtil.getStreamId(filePath);
		if (!streamId) {
			return locationMap;
		}

		const currentCommitHash = await git.getFileCurrentSha(filePath);
		if (!currentCommitHash) {
			return locationMap;
		}

		const markers = await MarkerUtil.getMarkers(streamId);
		const response = await api.getMarkerLocations(
			config.token,
			config.teamId,
			streamId,
			currentCommitHash
		);

		// const locations = response.markerLocations.locations;
		// const missingMarkerIds = getMissingMarkerIds(markers, locations);
		const missingMarkersByCommitHashWhenCreated = new Map<string, CSMarker[]>();
		for (const m of markers) {
			// if (!missingMarkerIds.has(m.id)) {
			// 	continue;
			// }
			let markersForCommitHash = missingMarkersByCommitHashWhenCreated.get(m.commitHashWhenCreated);
			if (!markersForCommitHash) {
				markersForCommitHash = [];
				missingMarkersByCommitHashWhenCreated.set(m.commitHashWhenCreated, markersForCommitHash);
			}
			markersForCommitHash.push(m);
		}
		// for (const entry of missingMarkersByCommitHashWhenCreated.entries()) {
		// 	const commitHashWhenCreated = entry[0];
		// 	const missingMarkers = entry[1];
		// 	const response = await api.getMarkerLocations(
		// 		config.token,
		// 		config.teamId,
		// 		streamId,
		// 		commitHashWhenCreated
		// 	);
		// 	const locationsAtCommit = response.markerLocations.locations;
		// 	const locationsToRecalculate = new Map<string, CSMarkerLocation>();
		// 	for (const m of missingMarkers) {
		// 		locationsToRecalculate.set(m.id, arrayToLocation(locationsAtCommit.get(m.id)));
		// 	}
		// 	const diff = await git.getDiff(commitHashWhenCreated, currentCommitHash, filePath);
		// 	const locationsAtCurrentCommit = await calculateLocations(locationsToRecalculate, diff);
		// }
		response.markerLocations;
		const doc = documents.get(documentUri);
		doc;

		return locationMap;
	}

	// function getMissingMarkerIds(markers: CSMarker[], locations: { [p: string]: any }): Set<string> {
	// 	const missingMarkerIds = new Set<string>();
	// 	for (const m of markers) {
	// 		missingMarkerIds.add(m.id);
	// 	}
	// 	for (const id in locations) {
	// 		missingMarkerIds.delete(id);
	// 	}
	// 	return missingMarkerIds;
	// }
}
