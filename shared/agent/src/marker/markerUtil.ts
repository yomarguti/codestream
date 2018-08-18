"use strict";

import { CSMarker } from "../api/api";
import { Container } from "../container";

type MarkersById = Map<string, CSMarker>;
type MarkersByStreamId = Map<string, MarkersById>;

export namespace MarkerUtil {
	const markersByStreamId: MarkersByStreamId = new Map();

	export async function getMarkers(streamId: string): Promise<MarkersById> {
		const { api, state } = Container.instance();

		let markersById = markersByStreamId.get(streamId);
		if (!markersById) {
			markersById = new Map();
			markersByStreamId.set(streamId, markersById);
			const response = await api.getMarkers(state.apiToken, state.teamId, streamId);
			for (const marker of response.markers) {
				markersById.set(marker.id, marker);
			}
		}
		return markersById;
	}

	export async function cacheMarkers(markers: CSMarker[]) {
		for (const marker of markers) {
			const markersById = await getMarkers(marker.streamId);
			markersById.set(marker.id, marker);
		}
	}
}
