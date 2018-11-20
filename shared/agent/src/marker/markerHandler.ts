"use strict";
import * as path from "path";
import { Range } from "vscode-languageserver";
import URI from "vscode-uri";
import { Container } from "../container";
import { Logger } from "../logger";
import {
	CSFullMarker,
	DocumentFromMarkerRequest,
	DocumentFromMarkerResponse,
	DocumentMarkersRequest,
	DocumentMarkersResponse,
	MarkerNotLocated,
	MarkerNotLocatedReason
} from "../shared/agent.protocol";

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
		try {
			const filePath = URI.parse(documentId.uri).fsPath;
			Logger.log(`MARKERS: requested markers for ${filePath}`);
			const stream = await Container.instance().files.getByPath(filePath);
			if (!stream) {
				Logger.log(`MARKERS: no streamId found for ${filePath} - returning empty response`);
				return emptyResponse;
			}

			const markers = await Container.instance().markers.getByStreamId(stream.id, true);
			Logger.log(`MARKERS: found ${markers.length} markers - retrieving current locations`);
			const {
				locations,
				missingLocations
			} = await Container.instance().markerLocations.getCurrentLocations(documentId.uri);

			Logger.log(`MARKERS: results:`);
			const markersWithRange: CSFullMarker[] = [];
			const markersNotLocated: MarkerNotLocated[] = [];
			for (const marker of markers) {
				const location = locations[marker.id];
				if (location) {
					const range = Container.instance().markerLocations.locationToRange(location);
					markersWithRange.push({
						...marker,
						codemark: await Container.instance().codemarks.getById(marker.codemarkId),
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
				markers: markersWithRange,
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
		const { git } = Container.instance();

		const repo = await git.getRepositoryById(repoId);
		if (repo === undefined) return undefined;

		const filePath = path.join(repo.path, file);
		const documentUri = URI.file(filePath).toString();

		const result = await Container.instance().markerLocations.getCurrentLocations(documentUri);
		const location = result.locations[markerId];
		const range = location
			? Container.instance().markerLocations.locationToRange(location)
			: Range.create(0, 0, 0, 0);

		const telemetry = Container.instance().telemetry;
		telemetry.track({
			eventName: "Codemark Clicked"
		});

		return {
			textDocument: { uri: documentUri },
			range: range,
			revision: undefined
		};
	}
}
