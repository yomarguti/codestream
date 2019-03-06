import * as paths from "path";
import { Range } from "vscode-languageserver-protocol";
import URI from "vscode-uri";
import { Logger } from "../logger";
import {
	GetRangeScmInfoRequest,
	GetRangeScmInfoRequestType,
	GetRangeScmInfoResponse
} from "../protocol/agent.protocol.scm";
import { Iterables, lsp, lspHandler, Strings } from "../system";
import { Container } from "./../container";

@lsp
export class ScmManager {
	@lspHandler(GetRangeScmInfoRequestType)
	async getRangeInfo({
		contents,
		dirty,
		range,
		uri: documentUri
	}: GetRangeScmInfoRequest): Promise<GetRangeScmInfoResponse> {
		const { git } = Container.instance();

		// Ensure range end is >= start
		if (
			range.start.line > range.end.line ||
			(range.start.line === range.end.line && range.start.character > range.end.character)
		) {
			range = Range.create(range.end, range.start);
		}

		const uri = URI.parse(documentUri);

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
					file = Strings.normalizePath(paths.relative(repoPath, uri.fsPath));
					if (file[0] === "/") {
						file = file.substr(1);
					}

					rev = await git.getFileCurrentRevision(uri.fsPath);
					const gitRemotes = await git.getRepoRemotes(repoPath);
					remotes = [...Iterables.map(gitRemotes, r => ({ name: r.name, url: r.normalizedUrl }))];

					if (dirty && contents == null) {
						const document = Container.instance().documents.get(documentUri);
						if (document === undefined) {
							throw new Error(`No document could be found for Uri(${documentUri})`);
						}

						contents = document.getText();
					}

					const gitAuthors = await git.getFileAuthors(uri.fsPath, {
						startLine: range.start.line,
						endLine: range.end.line,
						contents: dirty ? contents : undefined
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
			uri: documentUri,
			range: range,
			contents: contents!, // should/would content ever be undefined at this point?
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
}
