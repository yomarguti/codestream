"use strict";

import * as path from "path";
import { Range } from "vscode-languageserver-protocol";
import URI from "vscode-uri";
import { Container } from "../container";
import { Logger } from "../logger";
import {
	CreateCodemarkRequest,
	CreateCodemarkRequestMarker,
	CreatePostWithCodemarkRequest,
	PreparePostWithCodeRequest,
	PreparePostWithCodeResponse
} from "../shared/agent.protocol";
import { CSMarkerLocation, CSPost } from "../shared/api.protocol";
import { Iterables, Strings } from "../system";

export namespace PostHandler {
	let lastFullCode = "";

	export async function documentPreparePost({
		textDocument: documentId,
		range,
		dirty
	}: PreparePostWithCodeRequest): Promise<PreparePostWithCodeResponse> {
		const { documents, git } = Container.instance();

		const document = documents.get(documentId.uri);
		if (document === undefined) {
			throw new Error(`No document could be found for Uri(${documentId.uri})`);
		}
		lastFullCode = document.getText();

		const uri = URI.parse(document.uri);

		let authors: { id: string; username: string }[] | undefined;
		let file: string | undefined;
		let remotes: { name: string; url: string }[] | undefined;
		let rev: string | undefined;

		let gitError;
		let repoPath;
		if (uri.scheme === "file") {
			try {
				repoPath = await git.getRepoRoot(uri.fsPath);
				if (repoPath !== undefined) {
					file = Strings.normalizePath(path.relative(repoPath, uri.fsPath));
					if (file[0] === "/") {
						file = file.substr(1);
					}

					rev = await git.getFileCurrentRevision(uri.fsPath);
					const gitRemotes = await git.getRepoRemotes(repoPath);
					remotes = [...Iterables.map(gitRemotes, r => ({ name: r.name, url: r.normalizedUrl }))];

					const gitAuthors = await git.getFileAuthors(uri.fsPath, {
						startLine: range.start.line,
						endLine: range.end.line - 1,
						contents: dirty ? lastFullCode : undefined
					});
					const authorEmails = gitAuthors.map(a => a.email);

					const users = await Container.instance().users.getByEmails(authorEmails);
					authors = [...Iterables.map(users, u => ({ id: u.id, username: u.username }))];
				}
			} catch (ex) {
				gitError = ex.toString();
				Logger.error(ex);
				debugger;
			}
		}

		return {
			code: document.getText(range),
			source:
				repoPath !== undefined
					? {
							file: file!,
							repoPath: repoPath,
							revision: rev!,
							authors: authors || [],
							remotes: remotes || []
					  }
					: undefined,
			gitError: gitError
		};
	}

	export async function documentPost({
		textDocument: documentId,
		rangeArray,
		text,
		code,
		source,
		streamId,
		parentPostId,
		mentionedUserIds,
		title,
		type,
		assignees,
		color
	}: CreatePostWithCodemarkRequest): Promise<CSPost | undefined> {
		const { git } = Container.instance();
		const filePath = URI.parse(documentId.uri).fsPath;
		const fileContents = lastFullCode;

		let codemark: CreateCodemarkRequest | undefined;
		let marker: CreateCodemarkRequestMarker | undefined;
		let commitHashWhenPosted: string | undefined;
		let location: CSMarkerLocation | undefined;
		let backtrackedLocation: CSMarkerLocation | undefined;
		let remotes: string[] | undefined;
		if (rangeArray) {
			const range = Range.create(rangeArray[0], rangeArray[1], rangeArray[2], rangeArray[3]);
			location = Container.instance().markerLocations.rangeToLocation(range);

			if (source) {
				if (source.revision) {
					commitHashWhenPosted = source.revision;
					backtrackedLocation = await Container.instance().markerLocations.backtrackLocation(
						documentId,
						fileContents,
						location
					);
				} else {
					commitHashWhenPosted = (await git.getRepoHeadRevision(source.repoPath))!;
					backtrackedLocation = Container.instance().markerLocations.emptyFileLocation();
				}
				if (source.remotes && source.remotes.length > 0) {
					remotes = source.remotes.map(r => r.url);
				}
			}

			marker = {
				code,
				remotes,
				file: source && source.file,
				commitHash: commitHashWhenPosted,
				location:
					backtrackedLocation &&
					Container.instance().markerLocations.locationToArray(backtrackedLocation)
			};

			codemark = {
				type: type,
				streamId: streamId,
				color: color,
				// status:
				title: title,
				assignees: assignees,
				markers: marker && [marker],
				remotes: remotes
			};
		}

		try {
			const post = (await Container.instance().posts.createPost({
				streamId,
				text,
				parentPostId,
				codemark,
				commitHashWhenPosted,
				mentionedUserIds,
				title,
				type,
				assignees,
				color
			})).post;

			if (post.codemark && post.codemark.markerIds && backtrackedLocation) {
				const meta = backtrackedLocation.meta;
				if (meta && (meta.startWasDeleted || meta.endWasDeleted)) {
					const uncommittedLocation = {
						...location!,
						id: post.codemark.markerIds[0]
					};

					await Container.instance().markerLocations.saveUncommittedLocation(
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
}
