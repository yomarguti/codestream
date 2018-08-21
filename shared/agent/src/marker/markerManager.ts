"use strict";
import { DidChangeDocumentMarkersNotification } from "../agent";
import { CSMarker, CSStream, StreamType } from "../api/api";
import { Container } from "../container";
import { StreamManager } from "../stream/streamManager";

type MarkersById = Map<string, CSMarker>;
type MarkersByStreamId = Map<string, MarkersById>;

export class MarkerManager {
	private static markersByStreamId: MarkersByStreamId = new Map();
	private static markersById: MarkersById = new Map();

	static async getMarkersForStream(streamId: string, visibleOnly?: boolean): Promise<MarkersById> {
		const allMarkers = MarkerManager.markersById;
		let streamMarkers = MarkerManager.markersByStreamId.get(streamId);

		if (!streamMarkers) {
			const { api, state } = Container.instance();
			streamMarkers = new Map();
			MarkerManager.markersByStreamId.set(streamId, streamMarkers);
			const response = await api.getMarkers(state.apiToken, state.teamId, streamId);
			for (const marker of response.markers) {
				allMarkers.set(marker.id, marker);
				streamMarkers.set(marker.id, marker);
			}
		}
		return visibleOnly ? await MarkerManager.filterMarkers(streamMarkers) : streamMarkers;
	}

	static async getMarker(markerId: string) {
		let marker = MarkerManager.markersById.get(markerId);
		if (!marker) {
			const { api, session } = Container.instance();
			marker = (await api.getMarker(session.apiToken, session.teamId, markerId)).marker;
			MarkerManager.markersById.set(markerId, marker);
		}
		return marker;
	}

	private static async filterMarkers(markers: MarkersById): Promise<MarkersById> {
		const includedMarkers: MarkersById = new Map();
		const { userId } = Container.instance().session;
		for (const marker of markers.values()) {
			if (!marker.postStreamId || marker.deactivated) {
				continue;
			}

			const stream = await StreamManager.getStream(marker.postStreamId);
			if (stream && MarkerManager.canSeeMarkers(stream, userId)) {
				includedMarkers.set(marker.id, marker);
			}
		}
		return includedMarkers;
	}

	private static canSeeMarkers(stream: CSStream, userId: string): boolean {
		if (stream.deactivated || stream.type === StreamType.File) return false;
		if (stream.type === StreamType.Channel) {
			if (stream.isArchived) return false;
			if (stream.memberIds === undefined) return true;
			if (!stream.memberIds.includes(userId)) return false;
		}
		return true;
	}

	static async cacheMarkers(markers: CSMarker[]) {
		const streamIds = new Set<string>();
		for (const marker of markers) {
			let streamId = marker.streamId;
			if (!streamId) {
				const cached = await MarkerManager.getMarker(marker.id);
				streamId = cached.streamId;
			}

			const streamMarkers = await MarkerManager.getMarkersForStream(streamId);
			const allMarkers = MarkerManager.markersById;
			MarkerManager.addOrMerge(streamMarkers, marker);
			MarkerManager.addOrMerge(allMarkers, marker);
			streamIds.add(streamId);
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

	private static addOrMerge(markers: MarkersById, marker: CSMarker) {
		const existing = markers.get(marker.id);
		if (existing) {
			markers.set(marker.id, {
				...existing,
				...marker
			});
		} else {
			markers.set(marker.id, marker);
		}
	}
}
