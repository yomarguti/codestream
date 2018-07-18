"use strict";

import { URL } from "url";
import { Range } from "vscode-languageserver";
import { CSMarkerLocation } from "../api/types";
import { StreamUtil } from "../git/streamUtil";
import { MarkerLocationUtil } from "../markerLocation/markerLocationUtil";
import { MarkerUtil } from "./markerUtil";

export namespace MarkerHandler {
	export interface MarkerWithRange {
		id: string;
		range: Range;
	}

	export interface HandleMarkersResponse {
		markers: MarkerWithRange[];
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

			const markersWithRange = [];
			for (const marker of markers) {
				markersWithRange.push({
					id: marker.id,
					range: locationToRange(locations[marker.id])
				});
			}

			return {
				markers: markersWithRange
			};
		} catch (err) {
			console.error(err);
			debugger;
			return emptyResponse;
		}
	}
}

function locationToRange(location: CSMarkerLocation): Range {
	return {
		start: {
			line: location.lineStart - 1,
			character: location.colStart - 1
		},
		end: {
			line: location.lineEnd - 1,
			character: location.colEnd - 1
		}
	};
}
