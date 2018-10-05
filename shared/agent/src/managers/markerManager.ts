"use strict";
import { Container } from "../container";
import { CSMarker, CSStream, StreamType } from "../shared/api.protocol";
import { IndexParams, IndexType } from "./index";
import { EntityManager, Id } from "./managers";

export class MarkerManager extends EntityManager<CSMarker> {
	protected async fetch(id: Id): Promise<CSMarker> {
		const { apiDeprecated, state } = Container.instance();
		const response = await apiDeprecated.getMarker(state.apiToken, state.teamId, id);
		return response.marker;
	}

	protected getIndexedFields(): IndexParams<CSMarker>[] {
		return [
			{
				fields: ["streamId"],
				type: IndexType.Group,
				fetchFn: this.fetchByStreamId.bind(this)
			}
		];
	}

	async getByStreamId(streamId: Id, visibleOnly?: boolean): Promise<CSMarker[]> {
		const markers = await this.cache.getGroup([["streamId", streamId]]);
		return visibleOnly ? await this.filterMarkers(markers) : markers;
	}

	protected async fetchByStreamId(values: any[]): Promise<CSMarker[]> {
		const [streamId] = values;
		const { apiDeprecated, state } = Container.instance();
		const response = await apiDeprecated.getMarkers(state.apiToken, state.teamId, streamId);
		return response.markers;
	}

	private async filterMarkers(markers: CSMarker[]): Promise<CSMarker[]> {
		const includedMarkers = [];
		const { session, streams } = Container.instance();

		for (const marker of markers) {
			if (!marker.postStreamId || marker.deactivated) {
				continue;
			}

			const stream = await streams.getById(marker.postStreamId);
			if (stream && this.canSeeMarkers(stream, session.userId)) {
				includedMarkers.push(marker);
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
}
