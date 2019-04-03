import * as paths from "path";
import URI from "vscode-uri";
import { Ranges } from "../api/extensions";
import { Logger } from "../logger";
import {
	GetFileScmInfoRequest,
	GetFileScmInfoRequestType,
	GetFileScmInfoResponse,
	GetRangeScmInfoRequest,
	GetRangeScmInfoRequestType,
	GetRangeScmInfoResponse,
	GetRangeSha1Request,
	GetRangeSha1RequestType,
	GetRangeSha1Response
} from "../protocol/agent.protocol";
import { Iterables, lsp, lspHandler, Strings } from "../system";
import { Container } from "./../container";

@lsp
export class ScmManager {
	@lspHandler(GetFileScmInfoRequestType)
	async getFileInfo({ uri: documentUri }: GetFileScmInfoRequest): Promise<GetFileScmInfoResponse> {
		const uri = URI.parse(documentUri);

		let file: string | undefined;
		let remotes: { name: string; url: string }[] | undefined;
		let rev: string | undefined;

		let gitError;
		let repoPath;
		if (uri.scheme === "file") {
			const { git } = Container.instance();

			try {
				repoPath = await git.getRepoRoot(uri.fsPath);
				if (repoPath !== undefined) {
					file = Strings.normalizePath(paths.relative(repoPath, uri.fsPath));
					if (file[0] === "/") {
						file = file.substr(1);
					}

					rev = await git.getFileCurrentRevision(uri.fsPath);
					const gitRemotes = await git.getRepoRemotes(repoPath);
					remotes = [...Iterables.map(gitRemotes, r => ({ name: r.name, url: r.normalizedUrl }))];
				}
			} catch (ex) {
				gitError = ex.toString();
				Logger.error(ex);
				debugger;
			}
		}

		return {
			uri: uri.toString(),
			scm:
				repoPath !== undefined
					? {
							file: file!,
							repoPath: repoPath,
							revision: rev!,
							remotes: remotes || []
					  }
					: undefined,
			error: gitError
		};
	}

	@lspHandler(GetRangeScmInfoRequestType)
	async getRangeInfo({
		uri: documentUri,
		range,
		dirty,
		contents,
		skipBlame
	}: GetRangeScmInfoRequest): Promise<GetRangeScmInfoResponse> {
		// Ensure range end is >= start
		range = Ranges.ensureStartBeforeEnd(range);

		const uri = URI.parse(documentUri);

		let authors: { id: string; username: string }[] | undefined;
		let file: string | undefined;
		let remotes: { name: string; url: string }[] | undefined;
		let rev: string | undefined;

		let document;
		if (contents == null) {
			document = Container.instance().documents.get(documentUri);
			if (document === undefined) {
				throw new Error(`No document could be found for Uri(${documentUri})`);
			}

			contents = document.getText(range);
		}

		let gitError;
		let repoPath;
		if (uri.scheme === "file") {
			const { git } = Container.instance();

			try {
				repoPath = await git.getRepoRoot(uri.fsPath);
				if (repoPath !== undefined) {
					file = Strings.normalizePath(paths.relative(repoPath, uri.fsPath));
					if (file[0] === "/") {
						file = file.substr(1);
					}

					rev = await git.getFileCurrentRevision(uri.fsPath);
					const gitRemotes = await git.getRepoRemotes(repoPath);
					remotes = [...Iterables.map(gitRemotes, r => ({ name: r.name, url: r.normalizedUrl }))];

					if (!skipBlame) {
						let blameContents;
						// Only fill out the blame contents if the file is dirty (so we can blame the dirty version)
						if (dirty) {
							if (document === undefined) {
								document = Container.instance().documents.get(documentUri);
								if (document === undefined) {
									throw new Error(`No document could be found for Uri(${documentUri})`);
								}
							}

							blameContents = document.getText();
						}

						const gitAuthors = await git.getFileAuthors(uri.fsPath, {
							startLine: range.start.line,
							endLine: range.end.line,
							contents: blameContents
						});
						const authorEmails = gitAuthors.map(a => a.email);

						const users = await Container.instance().users.getByEmails(authorEmails);
						authors = [...Iterables.map(users, u => ({ id: u.id, username: u.username }))];
					}
				}
			} catch (ex) {
				gitError = ex.toString();
				Logger.error(ex);
				debugger;
			}
		}

		return {
			uri: uri.toString(),
			range: range,
			contents: contents,
			scm:
				repoPath !== undefined
					? {
							file: file!,
							repoPath: repoPath,
							revision: rev!,
							authors: authors || [],
							remotes: remotes || []
					  }
					: undefined,
			error: gitError
		};
	}

	@lspHandler(GetRangeSha1RequestType)
	async getRangeSha1({ uri, range }: GetRangeSha1Request): Promise<GetRangeSha1Response> {
		// Ensure range end is >= start
		range = Ranges.ensureStartBeforeEnd(range);

		const document = Container.instance().documents.get(uri);
		if (document === undefined) {
			throw new Error(`No document could be found for Uri(${uri})`);
		}

		const content = document.getText(range);
		return { sha1: Strings.sha1(content) };
	}
}
