"use strict";

import * as path from "path";
import { Error } from "tslint/lib/error";
import { TextDocumentIdentifier } from "vscode-languageserver";
import { Range } from "vscode-languageserver-protocol";
import URI from "vscode-uri";
import { CreatePostRequestCodeBlock, CSMarkerLocation, CSPost } from "../api/api";
import { Container } from "../container";
import { MarkerLocationUtil } from "../markerLocation/markerLocationUtil";

export namespace PostHandler {
	export async function postCode(
		documentId: TextDocumentIdentifier,
		rangeArray: [number, number, number, number] | undefined,
		text: string,
		streamId: string,
		parentPostId: string | undefined,
		mentionedUserIds: string[]
	): Promise<CSPost | undefined> {
		const { api, state, git, documents } = Container.instance();
		debugger;

		const document = documents.get(documentId.uri);
		if (!document) {
			throw new Error(`Could not retrieve document ${documentId.uri} from document manager`);
		}
		const filePath = URI.parse(documentId.uri).fsPath;
		// const streamId = await StreamUtil.getStreamId(filePath);
		const fileContents = document.getText();

		// let stream: CreatePostRequestStream | undefined;
		let codeBlock: CreatePostRequestCodeBlock | undefined;
		let commitHashWhenPosted: string | undefined;
		let location: CSMarkerLocation | undefined;
		let backtrackedLocation: CSMarkerLocation | undefined;
		if (rangeArray) {
			const range = Range.create(rangeArray[0], rangeArray[1], rangeArray[2], rangeArray[3]);
			location = MarkerLocationUtil.rangeToLocation(range);

			const code = document.getText(range);
			const preContext = document.getText(preRange(range));
			const postContext = document.getText(postRange(range));
			const repoRoot = await git.getRepoRoot(filePath);

			let relPath;
			let remotes;
			if (repoRoot) {
				relPath = path.relative(repoRoot, filePath);
				remotes = (await git.getRepoRemotes(repoRoot)).map(r => r.normalizedUrl);

				const fileCurrentRevision = await git.getFileCurrentRevision(filePath);
				if (fileCurrentRevision) {
					commitHashWhenPosted = fileCurrentRevision;
					backtrackedLocation = await MarkerLocationUtil.backtrackLocation(documentId, location);
				} else {
					commitHashWhenPosted = (await git.getRepoHeadRevision(repoRoot))!;
					backtrackedLocation = MarkerLocationUtil.emptyFileLocation();
				}
			}

			codeBlock = {
				code,
				preContext,
				postContext,
				file: relPath,
				remotes,
				location: backtrackedLocation && MarkerLocationUtil.locationToArray(backtrackedLocation)
			};
		}

		try {
			const post = (await api.createPost(state.apiToken, {
				teamId: state.teamId,
				streamId,
				text,
				parentPostId,
				codeBlocks: codeBlock && [codeBlock],
				commitHashWhenPosted,
				mentionedUserIds
			})).post;

			if (post.codeBlocks) {
				const meta = backtrackedLocation!.meta;
				if (meta && (meta.startWasDeleted || meta.endWasDeleted)) {
					const uncommittedLocation = {
						id: post.codeBlocks[0].markerId,
						...location!
					};

					await MarkerLocationUtil.saveUncommittedLocation(
						filePath,
						fileContents,
						uncommittedLocation
					);
				}
			}

			return post;
		} catch (ex) {
			debugger;
			return;
		}
	}

	function preRange(range: Range): Range {
		const { start } = range;
		const preStart = {
			line: Math.max(start.line - 3, 0),
			character: 0
		};
		const preEnd = {
			line: start.line,
			character: start.character
		};
		const preRange = {
			start: preStart,
			end: preEnd
		};
		return preRange;
	}

	function postRange(range: Range) {
		const { end } = range;
		const postStart = {
			line: end.line + 4,
			character: end.character
		};
		const postEnd = {
			line: end.line + 4,
			character: 0
		};
		const postRange = {
			start: postStart,
			end: postEnd
		};
		return postRange;
	}
}
