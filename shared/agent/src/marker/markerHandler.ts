"use strict";
import * as path from "path";
import { Range } from "vscode-languageserver";
import URI from "vscode-uri";
import { MarkerLocation } from "../api/extensions";
import { Container } from "../container";
import { Logger } from "../logger";
import {
	DocumentFromMarkerRequest,
	DocumentFromMarkerResponse,
	DocumentMarker,
	DocumentMarkersRequest,
	DocumentMarkersResponse,
	MarkerNotLocated,
	MarkerNotLocatedReason
} from "../shared/agent.protocol";

const emojiMap: { [key: string]: string } = require("../../emoji/emojis.json");
const emojiRegex = /:([-+_a-z0-9]+):/g;
const escapeMarkdownRegex = /[`\>\#\*\_\-\+\.]/g;
// const sampleMarkdown = '## message `not code` *not important* _no underline_ \n> don\'t quote me \n- don\'t list me \n+ don\'t list me \n1. don\'t list me \nnot h1 \n=== \nnot h2 \n---\n***\n---\n___';
const markdownHeaderReplacement = "\u200b===";

export namespace MarkerHandler {
	const emptyResponse = {
		markers: [],
		markersNotLocated: []
	};

	// export function onHover(e: TextDocumentPositionParams) {
	// 	Logger.log("Hover request received");
	// 	return undefined;
	// }

	export async function documentMarkers({
		textDocument: documentId
	}: DocumentMarkersRequest): Promise<DocumentMarkersResponse> {
		const { codemarks, files, markers, markerLocations, users } = Container.instance();

		try {
			const filePath = URI.parse(documentId.uri).fsPath;
			Logger.log(`MARKERS: requested markers for ${filePath}`);
			const stream = await files.getByPath(filePath);
			if (!stream) {
				Logger.log(`MARKERS: no streamId found for ${filePath} - returning empty response`);
				return emptyResponse;
			}

			const markersForDocument = await markers.getByStreamId(stream.id, true);
			Logger.log(
				`MARKERS: found ${markersForDocument.length} markers - retrieving current locations`
			);
			const { locations, missingLocations } = await markerLocations.getCurrentLocations(
				documentId.uri
			);

			Logger.log(`MARKERS: results:`);
			const documentMarkers: DocumentMarker[] = [];
			const markersNotLocated: MarkerNotLocated[] = [];
			for (const marker of markersForDocument) {
				const location = locations[marker.id];
				if (location) {
					const range = MarkerLocation.toRange(location);
					const [codemark, creator] = await Promise.all([
						codemarks.getById(marker.codemarkId),
						users.getById(marker.creatorId)
					]);

					const summary = (codemark.title || codemark.text).replace(
						emojiRegex,
						(s, code) => emojiMap[code] || s
					);

					documentMarkers.push({
						...marker,
						summary: summary,
						summaryMarkdown: `\n\n> ${summary
							// Escape markdown
							.replace(escapeMarkdownRegex, "\\$&")
							// Escape markdown header (since the above regex won't match it)
							.replace(/^===/gm, markdownHeaderReplacement)
							// Keep under the same block-quote but with line breaks
							.replace(/\n/g, "\t\n>  ")}`,
						creatorName: creator.username,
						codemark: codemark,
						range
					});
					Logger.log(
						`MARKERS: ${marker.id}=[${location.lineStart}, ${location.colStart}, ${
							location.lineEnd
						}, ${location.colEnd}]`
					);
				} else {
					const missingLocation = missingLocations[marker.id];
					if (missingLocation) {
						markersNotLocated.push({
							...marker,
							notLocatedReason: missingLocation.reason,
							notLocatedDetails: missingLocation.details
						});
						Logger.log(
							`MARKERS: ${marker.id}=${missingLocation.details || "location not found"}, reason: ${
								missingLocation.reason
							}`
						);
					} else {
						markersNotLocated.push({
							...marker,
							notLocatedReason: MarkerNotLocatedReason.UNKNOWN
						});
						Logger.log(`MARKERS: ${marker.id}=location not found, reason: unknown`);
					}
				}
			}

			return {
				markers: documentMarkers,
				markersNotLocated
			};
		} catch (err) {
			console.error(err);
			debugger;
			return emptyResponse;
		}
	}

	export async function documentFromMarker({
		repoId,
		file,
		markerId
	}: DocumentFromMarkerRequest): Promise<DocumentFromMarkerResponse | undefined> {
		const { git, markers, markerLocations } = Container.instance();

		const repo = await git.getRepositoryById(repoId);
		if (repo === undefined) return undefined;

		const filePath = path.join(repo.path, file);
		const documentUri = URI.file(filePath).toString();

		const marker = await markers.getById(markerId);
		const result = await markerLocations.getCurrentLocations(documentUri);
		const location = result.locations[markerId];
		const range = location ? MarkerLocation.toRange(location) : Range.create(0, 0, 0, 0);

		return {
			textDocument: { uri: documentUri },
			marker: marker,
			range: range,
			revision: undefined
		};
	}
}
