"use strict";

import { URL } from "url";
import { StreamUtil } from "../git/streamUtil";
import { MarkerUtil } from "./markerUtil";
import { CSMarker } from "../api/types";
import { MarkerLocationUtil } from "../markerLocation/markerLocationUtil";

export namespace MarkerHandler {
	export interface HandleMarkersResponse {
		markers: CSMarker[];
	}

	const emptyResponse = {
		markers: []
	};

	export async function handle(params: any[]): Promise<HandleMarkersResponse> {
		try {
			const textDocument = params[0].textDocument as { uri: string };
			const filePath = new URL(textDocument.uri).pathname;

			// const token = params[1] as rpc.CancellationToken;
			// const repoId = RepoUtil.getRepoId(filePath);

			debugger;
			const streamId = await StreamUtil.getStreamId(filePath);
			if (!streamId) {
				return emptyResponse;
			}

			const markers = await MarkerUtil.getMarkers(streamId);
			const locations = await MarkerLocationUtil.getCurrentLocations(textDocument.uri);
			locations;
			debugger;
			return {
				markers
			};
		} catch (err) {
			console.error(err);
			debugger;
			return emptyResponse;
		}
	}
}
