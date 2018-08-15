"use strict";
import { TextDocumentIdentifier, TextDocumentPositionParams } from "vscode-languageserver";
import URI from "vscode-uri";
import { DocumentFromCodeBlockResponse, DocumentMarkersResponse } from "../agent";
import { Logger } from "../logger";
import { MarkerLocationUtil } from "../markerLocation/markerLocationUtil";
import { MarkerWithRange } from "../shared/agent.protocol";
import { StreamUtil } from "../stream/streamUtil";
import { MarkerUtil } from "./markerUtil";
import * as path from "path";
import { Container } from "../container";

export namespace MarkerHandler {
	const emptyResponse = {
		markers: []
	};

	export function onHover(e: TextDocumentPositionParams) {
		Logger.log("Hover request received");
		return undefined;
	}

	export async function documentMarkers(
		document: TextDocumentIdentifier
	): Promise<DocumentMarkersResponse> {
		try {
			const filePath = URI.parse(document.uri).fsPath;
			const streamId = await StreamUtil.getStreamId(filePath);
			if (!streamId) {
				return emptyResponse;
			}

			const markers = await MarkerUtil.getMarkers(streamId);
			const locations = await MarkerLocationUtil.getCurrentLocations(document.uri);
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

	export async function documentFromCodeBlock(
		repoId: string,
		file: string,
		markerId: string
	): Promise<DocumentFromCodeBlockResponse | undefined> {
		const { git } = Container.instance();
		const repo = await git.getRepositoryById(repoId);
		if (repo === undefined) {
			return undefined;
		}
		const filePath = path.join(repo.path, file);
		const documentUri = URI.file(filePath).toString();
		const locationsById = await MarkerLocationUtil.getCurrentLocations(documentUri);
		const location = locationsById[markerId];
		const range = MarkerLocationUtil.locationToRange(location);

		return {
			textDocument: { uri: documentUri },
			range: range,
			revision: undefined
		};
	}
}
