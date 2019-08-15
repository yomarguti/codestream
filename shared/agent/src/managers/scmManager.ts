import * as paths from "path";
import { URI } from "vscode-uri";
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
import { FileSystem, Iterables, log, lsp, lspHandler, Strings } from "../system";
import { Container, SessionContainer } from "./../container";

@lsp
export class ScmManager {
	@lspHandler(GetFileScmInfoRequestType)
	@log()
	async getFileInfo({ uri: documentUri }: GetFileScmInfoRequest): Promise<GetFileScmInfoResponse> {
		const cc = Logger.getCorrelationContext();

		const uri = URI.parse(documentUri);

		let file: string | undefined;
		let remotes: { name: string; url: string }[] | undefined;
		let rev: string | undefined;
		let branch: string | undefined;

		let gitError;
		let repoPath;
		if (uri.scheme === "file") {
			const { git } = SessionContainer.instance();

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
				branch = await git.getCurrentBranch(uri.fsPath);
			} catch (ex) {
				gitError = ex.toString();
				Logger.error(ex, cc);
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
							remotes: remotes || [],
							branch
					  }
					: undefined,
			error: gitError
		};
	}

	@lspHandler(GetRangeScmInfoRequestType)
	@log()
	async getRangeInfo({
		uri: documentUri,
		range,
		dirty,
		contents,
		skipBlame
	}: GetRangeScmInfoRequest): Promise<GetRangeScmInfoResponse> {
		const cc = Logger.getCorrelationContext();

		// Ensure range end is >= start
		range = Ranges.ensureStartBeforeEnd(range);

		const uri = URI.parse(documentUri);

		let authors: { id: string; username: string }[] | undefined;
		let file: string | undefined;
		let remotes: { name: string; url: string }[] | undefined;
		let rev: string | undefined;
		let branch: string | undefined;

		let document;
		if (contents == null) {
			document = Container.instance().documents.get(documentUri);
			if (document === undefined) {
				const ex = new Error(`No document could be found for Uri(${documentUri})`);
				Logger.error(ex, cc);
				throw ex;
			}

			contents = document.getText(range);
		}

		let gitError;
		let repoPath;
		if (uri.scheme === "file") {
			const { git } = SessionContainer.instance();

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
									const ex = new Error(`No document could be found for Uri(${documentUri})`);
									Logger.error(ex, cc);
									throw ex;
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

						const users = await SessionContainer.instance().users.getByEmails(authorEmails);
						authors = [...Iterables.map(users, u => ({ id: u.id, username: u.username }))];
					}
				}
				branch = await git.getCurrentBranch(uri.fsPath);
			} catch (ex) {
				gitError = ex.toString();
				Logger.error(ex, cc);
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
							remotes: remotes || [],
							branch
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
			try {
				const sha1 = await FileSystem.sha1(URI.parse(uri).fsPath, range);
				return { sha1: sha1 };
			} catch (ex) {
				Logger.error(ex);
				return { sha1: undefined };
			}
		}

		// Normalize to /n line endings
		const content = document.getText(range).replace(/\r\n/g, "\n");
		return { sha1: Strings.sha1(content) };
	}
}
