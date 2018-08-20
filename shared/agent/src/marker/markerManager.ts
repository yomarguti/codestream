"use strict";

import { CSMarker } from "../api/api";
import { Container } from "../container";
import { StreamManager } from "../stream/streamManager";
import { DidChangeDocumentMarkersNotification } from "../shared/agent.protocol";

type MarkersById = Map<string, CSMarker>;
type MarkersByStreamId = Map<string, MarkersById>;

export class MarkerManager {
	private static markersByStreamId: MarkersByStreamId = new Map();

	static async getMarkers(streamId: string): Promise<MarkersById> {
		let markersById = MarkerManager.markersByStreamId.get(streamId);

		if (!markersById) {
			const { api, state } = Container.instance();
			markersById = new Map();
			MarkerManager.markersByStreamId.set(streamId, markersById);
			const response = await api.getMarkers(state.apiToken, state.teamId, streamId);
			for (const marker of response.markers) {
				markersById.set(marker.id, marker);
			}
		}

		return markersById;
	}

	static async cacheMarkers(markers: CSMarker[]) {
		const streamIds = new Set<string>();
		for (const marker of markers) {
			const markersById = await MarkerManager.getMarkers(marker.streamId);
			markersById.set(marker.id, marker);
			streamIds.add(marker.streamId);
		}

		for (const streamId of streamIds) {
			const textDocument = await StreamManager.getTextDocument(streamId);
			if (textDocument) {
				Container.instance().session.agent.sendNotification(DidChangeDocumentMarkersNotification, {
					textDocument
				});
			}
		}
	}
}
