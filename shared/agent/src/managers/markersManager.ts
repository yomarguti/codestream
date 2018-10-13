"use strict";
import { Container } from "../container";
import {
	DidChangeDocumentMarkersNotificationType,
	GetMarkerRequest,
	GetMarkerRequestType,
	GetMarkerResponse
} from "../shared/agent.protocol";
import { CSMarker, CSStream, StreamType } from "../shared/api.protocol";
import { lspHandler } from "../system";
import { getValues, KeyValue } from "./cache/baseCache";
import { IndexParams, IndexType } from "./cache/index";
import { EntityManagerBase, Id } from "./entityManager";

export class MarkersManager extends EntityManagerBase<CSMarker> {
	initialize() {
		this.session.onDidChangeMarkers(async (markers: CSMarker[]) => {
			const { files } = Container.instance();
			const streamIds = new Set<Id>();

			for (const marker of markers) {
				streamIds.add(marker.streamId);
			}

			for (const streamId of streamIds) {
				const uri = await files.getDocumentUri(streamId);
				if (uri) {
					this.session.agent.sendNotification(DidChangeDocumentMarkersNotificationType, {
						textDocument: {
							uri
						}
					});
				}
			}
		});
	}

	async getByStreamId(streamId: Id, visibleOnly?: boolean): Promise<CSMarker[]> {
		const markers = await this.cache.getGroup([["streamId", streamId]]);
		return visibleOnly ? await this.filterMarkers(markers) : markers;
	}

	protected async fetchById(id: Id): Promise<CSMarker> {
		const response = await this.session.api.getMarker({ markerId: id });
		return response.marker;
	}

	getIndexedFields(): IndexParams<CSMarker>[] {
		return [
			{
				fields: ["streamId"],
				type: IndexType.Group,
				fetchFn: this.fetchByStreamId.bind(this)
			}
		];
	}

	protected async fetchByStreamId(criteria: KeyValue<CSMarker>[]): Promise<CSMarker[]> {
		const [streamId] = getValues(criteria);
		const response = await this.session.api.fetchMarkers({ streamId: streamId });
		return response.markers;
	}

	private async filterMarkers(markers: CSMarker[]): Promise<CSMarker[]> {
		const includedMarkers = [];
		const { streams } = Container.instance();

		for (const marker of markers) {
			if (!marker.postStreamId || marker.deactivated) {
				continue;
			}

			try {
				const stream = await streams.getById(marker.postStreamId);
				if (stream && this.canSeeMarkers(stream, this.session.userId)) {
					includedMarkers.push(marker);
				}
			} catch (ignore) {
				// TODO the APIs will fail when the user doesn't have access to the channel/dm
			}
		}

		return includedMarkers;
	}

	private canSeeMarkers(stream: CSStream, userId: string): boolean {
		if (stream.deactivated || stream.type === StreamType.File) return false;
		if (stream.type === StreamType.Channel) {
			if (stream.isArchived) return false;
			if (stream.memberIds === undefined) return true;
			if (!stream.memberIds.includes(userId)) return false;
		}
		return true;
	}

	@lspHandler(GetMarkerRequestType)
	private async getMarker(request: GetMarkerRequest): Promise<GetMarkerResponse> {
		const marker = await this.getById(request.markerId);
		return { marker: marker };
	}
}
