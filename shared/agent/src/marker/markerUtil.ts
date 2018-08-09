"use strict";

import { CSMarker } from "../api/api";
import { Container } from "../container";

export namespace MarkerUtil {
	const markersByStreamId = new Map<string, CSMarker[]>();

	export async function getMarkers(streamId: string): Promise<CSMarker[]> {
		const { api, state } = Container.instance();

		let markers = markersByStreamId.get(streamId);
		if (!markers) {
			const response = await api.getMarkers(state.apiToken, state.teamId, streamId);
			markers = response.markers;
			markersByStreamId.set(streamId, markers);
		}
		return markers;
	}
}
