"use strict";
import { Range, TextDocumentIdentifier, TextDocumentPositionParams } from "vscode-languageserver";
import URI from "vscode-uri";
import { DocumentMarkersResponse } from "../agent";
import { CSMarkerLocation } from "../api/api";
import { Logger } from "../logger";
import { MarkerLocationUtil } from "../markerLocation/markerLocationUtil";
import { MarkerWithRange } from "../shared/agent.protocol";
import { StreamUtil } from "../stream/streamUtil";
import { MarkerUtil } from "./markerUtil";

export namespace MarkerHandler {
	const emptyResponse = {
		markers: []
	};

	export function onHover(e: TextDocumentPositionParams) {
		Logger.log("Hover request received");
		return undefined;
	}

	export async function onRequest(
		document: TextDocumentIdentifier
	): Promise<DocumentMarkersResponse> {
		Logger.log("Marker request received");
		try {
			const filePath = URI.parse(document.uri).fsPath;
			const streamId = await StreamUtil.getStreamId(filePath);
			if (!streamId) {
				return emptyResponse;
			}

			const markers = await MarkerUtil.getMarkers(streamId);
			const locations = await MarkerLocationUtil.getCurrentLocations(document.uri);
			const markersWithRange = markers.map(
				m => ({ ...m, range: locationToRange(locations[m.id]) } as MarkerWithRange)
			);

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
