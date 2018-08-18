"use strict";
import * as path from "path";
import { Range, TextDocumentPositionParams } from "vscode-languageserver";
import URI from "vscode-uri";
import {
	DocumentFromCodeBlockRequestParams,
	DocumentFromCodeBlockResponse,
	DocumentMarkersRequestParams,
	DocumentMarkersResponse,
	MarkerWithRange
} from "../agent";
import { Container } from "../container";
import { Logger } from "../logger";
import { MarkerLocationUtil } from "../markerLocation/markerLocationUtil";
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

	export async function documentMarkers({
		textDocument: documentId
	}: DocumentMarkersRequestParams): Promise<DocumentMarkersResponse> {
		try {
			const filePath = URI.parse(documentId.uri).fsPath;
			const streamId = await StreamUtil.getStreamId(filePath);
			if (!streamId) return emptyResponse;

			const markersById = await MarkerUtil.getMarkers(streamId);
			const markers = Array.from(markersById.values());
			const locations = await MarkerLocationUtil.getCurrentLocations(documentId.uri);
			const markersWithRange = markers.map(
				m =>
					({ ...m, range: MarkerLocationUtil.locationToRange(locations[m.id]) } as MarkerWithRange)
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

	export async function documentFromCodeBlock({
		repoId,
		file,
		markerId
	}: DocumentFromCodeBlockRequestParams): Promise<DocumentFromCodeBlockResponse | undefined> {
		const { git } = Container.instance();

		const repo = await git.getRepositoryById(repoId);
		if (repo === undefined) return undefined;

		const filePath = path.join(repo.path, file);
		const documentUri = URI.file(filePath).toString();

		const locationsById = await MarkerLocationUtil.getCurrentLocations(documentUri);
		const location = locationsById[markerId];
		const range = location
			? MarkerLocationUtil.locationToRange(location)
			: Range.create(0, 0, 0, 0);

		return {
			textDocument: { uri: documentUri },
			range: range,
			revision: undefined
		};
	}
}
