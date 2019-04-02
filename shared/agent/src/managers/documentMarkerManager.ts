"use strict";
import * as path from "path";
import { CodeStreamSession } from "session";
import { Range, TextDocumentChangeEvent } from "vscode-languageserver";
import URI from "vscode-uri";
import { Marker, MarkerLocation, Ranges } from "../api/extensions";
import { Container } from "../container";
import { Logger } from "../logger";
import {
	CreateDocumentMarkerPermalinkRequest,
	CreateDocumentMarkerPermalinkRequestType,
	CreateDocumentMarkerPermalinkResponse,
	DidChangeDocumentMarkersNotificationType,
	DocumentFromMarkerRequest,
	DocumentFromMarkerRequestType,
	DocumentFromMarkerResponse,
	DocumentMarker,
	DocumentMarkersRequest,
	DocumentMarkersRequestType,
	DocumentMarkersResponse,
	MarkerNotLocated,
	MarkerNotLocatedReason
} from "../protocol/agent.protocol";
import { CodemarkType, CSCodemark, CSMarker } from "../protocol/api.protocol";
import { Functions, lsp, lspHandler } from "../system";

const emojiMap: { [key: string]: string } = require("../../emoji/emojis.json");
const emojiRegex = /:([-+_a-z0-9]+):/g;
const escapeMarkdownRegex = /[`\>\#\*\_\-\+\.]/g;
// const sampleMarkdown = '## message `not code` *not important* _no underline_ \n> don\'t quote me \n- don\'t list me \n+ don\'t list me \n1. don\'t list me \nnot h1 \n=== \nnot h2 \n---\n***\n---\n___';
const markdownHeaderReplacement = "\u200b===";

const emptyResponse = {
	markers: [],
	markersNotLocated: []
};

@lsp
export class DocumentMarkerManager {
	constructor(readonly session: CodeStreamSession) {
		this.session.onDidChangeCodemarks(this.onCodemarksChanged, this);
		this.session.onDidChangeMarkers(this.onMarkersChanged, this);
		this.session.agent.documents.onDidChangeContent(this.onDocumentContentChanged, this);
	}

	private onCodemarksChanged(codemarks: CSCodemark[]) {
		const fileStreamIds = new Set<string>();
		for (const codemark of codemarks) {
			if (codemark.fileStreamIds) {
				for (const fileStreamId of codemark.fileStreamIds) {
					fileStreamIds.add(fileStreamId);
				}
			}
		}

		this.onFileStreamsChanged(fileStreamIds);
	}

	private onDocumentContentChanged(e: TextDocumentChangeEvent) {
		this.fireDidChangeDocumentMarkers(e.document.uri, "document");
	}

	private onMarkersChanged(markers: CSMarker[]) {
		const fileStreamIds = new Set<string>();
		for (const marker of markers) {
			fileStreamIds.add(marker.fileStreamId);
		}

		this.onFileStreamsChanged(fileStreamIds);
	}

	private async onFileStreamsChanged(fileStreamIds: Set<string>) {
		const { files } = Container.instance();

		for (const fileStreamId of fileStreamIds) {
			const uri = await files.getDocumentUri(fileStreamId);
			if (uri) {
				this.fireDidChangeDocumentMarkers(uri, "codemarks");
			}
		}
	}

	private _debouncedDocumentMarkersChangedByReason = new Map<
		"document" | "codemarks",
		(uri: string, reason: "document" | "codemarks") => Promise<void>
	>();

	private async fireDidChangeDocumentMarkers(uri: string, reason: "document" | "codemarks") {
		// Normalize the uri to vscode style uri formating
		uri = URI.parse(uri).toString();

		let fn = this._debouncedDocumentMarkersChangedByReason.get(reason);
		if (fn === undefined) {
			// Create a debounced function based on the reason that is uniquely debounced by the uri
			fn = Functions.debounceMemoized(
				this.fireDidChangeDocumentMarkersCore.bind(this),
				// If we are firing because of a codemark/marker change, only wait 100ms, otherwise 1s with a max of 3s
				reason === "codemarks" ? 100 : 1000,
				{
					maxWait: 3000,
					resolver: function(uri: string, reason: "document" | "codemarks") {
						return uri;
					}
				}
			);
			this._debouncedDocumentMarkersChangedByReason.set(reason, fn);
		}

		fn(uri, reason);
	}

	private async fireDidChangeDocumentMarkersCore(uri: string, reason: "document" | "codemarks") {
		this.session.agent.sendNotification(DidChangeDocumentMarkersNotificationType, {
			textDocument: {
				uri: uri
			},
			reason: reason
		});
	}

	@lspHandler(CreateDocumentMarkerPermalinkRequestType)
	async createPermalink({
		uri,
		range,
		privacy,
		contents
	}: CreateDocumentMarkerPermalinkRequest): Promise<CreateDocumentMarkerPermalinkResponse> {
		const { codemarks, scm, git } = Container.instance();

		const scmResponse = await scm.getRangeInfo({
			uri: uri,
			range: range,
			contents: contents,
			skipBlame: true
		});
		const remotes = scmResponse.scm && scmResponse.scm.remotes.map(r => r.url);

		let remoteCodeUrl;
		if (remotes !== undefined && scmResponse.scm !== undefined && scmResponse.scm.revision) {
			// Ensure range end is >= start
			range = Ranges.ensureStartBeforeEnd(range);

			for (const remote of remotes) {
				remoteCodeUrl = Marker.getRemoteCodeUrl(
					remote,
					scmResponse.scm.revision,
					scmResponse.scm.file,
					scmResponse.range.start.line + 1,
					scmResponse.range.end.line + 1
				);

				if (remoteCodeUrl !== undefined) {
					break;
				}
			}
		}

		let commitHash;
		let location;
		if (scmResponse.scm) {
			if (!scmResponse.scm.revision) {
				commitHash = (await git.getRepoHeadRevision(scmResponse.scm.repoPath))!;
				location = MarkerLocation.toArray(MarkerLocation.empty());
			} else {
				commitHash = scmResponse.scm.revision;
				location = MarkerLocation.toArrayFromRange(range);
			}
		}

		const response = await codemarks.create({
			type: CodemarkType.Link,
			markers: [
				{
					code: scmResponse.contents,
					remotes: remotes,
					commitHash: commitHash,
					file: scmResponse.scm && scmResponse.scm.file,
					location: location
				}
			],
			remotes: remotes,
			remoteCodeUrl: remoteCodeUrl,
			createPermalink: privacy
		});

		const telemetry = Container.instance().telemetry;
		const payload = { Access: privacy === "public" ? "Public" : "Private" };
		telemetry.track({ eventName: "Permalink Created", properties: payload });

		return { linkUrl: response.permalink! };
	}

	@lspHandler(DocumentMarkersRequestType)
	async get({
		textDocument: documentId
	}: DocumentMarkersRequest): Promise<DocumentMarkersResponse> {
		const { codemarks, files, markers, markerLocations, users } = Container.instance();

		try {
			const documentUri = URI.parse(documentId.uri);

			const filePath = documentUri.fsPath;
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
				documentId.uri,
				stream,
				markersForDocument
			);

			Logger.log(`MARKERS: results:`);
			const documentMarkers: DocumentMarker[] = [];
			const markersNotLocated: MarkerNotLocated[] = [];
			for (const marker of markersForDocument) {
				const [codemark, creator] = await Promise.all([
					codemarks.getById(marker.codemarkId).then(c => codemarks.fullCodemark(c)),
					// HACK: This is a total hack for slack to avoid getting codestream users mixed with slack users in the cache
					users.getById(marker.creatorId, { avoidCachingOnFetch: true })
				]);

				// Only return markers that are not links, are pinned, and issues that are not closed
				if (
					// !codemark.pinned ||
					codemark.type === CodemarkType.Link
					// (codemark.type === CodemarkType.Issue && codemark.status === CodemarkStatus.Closed)
				) {
					continue;
				}

				const location = locations[marker.id];
				if (location) {
					let summary = codemark.title || codemark.text || "";
					if (summary.length !== 0) {
						summary = (codemark.title || codemark.text).replace(
							emojiRegex,
							(s, code) => emojiMap[code] || s
						);
					}

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
						range: MarkerLocation.toRange(location)
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

	@lspHandler(DocumentFromMarkerRequestType)
	async getDocumentFromMarker({
		repoId,
		file,
		markerId
	}: DocumentFromMarkerRequest): Promise<DocumentFromMarkerResponse | undefined> {
		const { git, markers, markerLocations } = Container.instance();

		if (repoId == null || file == null) {
			const marker = await markers.getById(markerId);
			file = marker.file;
			repoId = marker.repoId;
		}

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
