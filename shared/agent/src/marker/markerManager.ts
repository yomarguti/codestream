"use strict";
import { DidChangeDocumentMarkersNotification } from "../agent";
import { CSMarker } from "../api/api";
import { Container } from "../container";
import { StreamManager } from "../stream/streamManager";

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
			const markers = await MarkerManager.filterMarkers(response.markers);
			for (const marker of markers) {
				markersById.set(marker.id, marker);
			}
		}

		return markersById;
	}

	private static async filterMarkers(markers: CSMarker[]): Promise<CSMarker[]> {
		const filteredMarkers: CSMarker[] = [];
		for (const marker of markers) {
			const stream = await StreamManager.getStream(marker.postStreamId);
			if (stream && !stream.isArchived && !stream.deactivated) {
				filteredMarkers.push(marker);
			}
		}
		return filteredMarkers;
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
