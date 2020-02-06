import { lastDayOfQuarter } from "date-fns";
import * as paths from "path";
import { URI } from "vscode-uri";
import { Ranges } from "../api/extensions";
import { GitCommit } from "../git/models/models";
import { Logger } from "../logger";
import {
	CoAuthors,
	FileStatus,
	GetCommitScmInfoRequest,
	GetCommitScmInfoRequestType,
	GetCommitScmInfoResponse,
	GetFileScmInfoRequest,
	GetFileScmInfoRequestType,
	GetFileScmInfoResponse,
	GetRangeScmInfoRequest,
	GetRangeScmInfoRequestType,
	GetRangeScmInfoResponse,
	GetRangeSha1Request,
	GetRangeSha1RequestType,
	GetRangeSha1Response,
	GetRepoScmStatusRequest,
	GetRepoScmStatusRequestType,
	GetRepoScmStatusResponse,
	GetReposScmRequestType,
	GetReposScmResponse
} from "../protocol/agent.protocol";
import { FileSystem, Iterables, log, lsp, lspHandler, Strings } from "../system";
import { Container, SessionContainer } from "./../container";

@lsp
export class ScmManager {
	@lspHandler(GetCommitScmInfoRequestType)
	@log()
	async getCommitInfo({
		revision,
		repoPath,
		repoId
	}: GetCommitScmInfoRequest): Promise<GetCommitScmInfoResponse> {
		const cc = Logger.getCorrelationContext();

		const { git } = SessionContainer.instance();

		if (!repoPath) {
			if (!repoId) {
				const ex = new Error("A repoPath or repoId is required");
				Logger.error(ex, cc);
				throw ex;
			}

			const repo = await git.getRepositoryById(repoId);
			if (repo == null) {
				const ex = new Error(`No repository could be found for repoId=${repoId}`);
				Logger.error(ex, cc);
				throw ex;
			}

			repoPath = repo.path;
		}

		let gitError;
		let commit;
		try {
			if (repoPath !== undefined) {
				commit = await git.getCommit(repoPath, revision);
			}
		} catch (ex) {
			gitError = ex.toString();
			Logger.error(ex, cc);
			debugger;
		}

		return {
			scm:
				commit !== undefined
					? {
						repoPath: commit.repoPath,
						revision: commit.ref,
						message: commit.message,
						shortMessage: commit.shortMessage,
						author: commit.author,
						authorDate: commit.authorDate
						// committerDate: commit.committerDate,
					}
					: undefined,
			error: gitError
		};
	}

	@lspHandler(GetReposScmRequestType)
	@log()
	async getRepos({
	}: GetRepoScmStatusRequest): Promise<GetReposScmResponse> {
		const cc = Logger.getCorrelationContext();
		let gitError;
		let repositories;
		try {
			const { git } = SessionContainer.instance();
			repositories = Array.from((await git.getRepositories()));
		} catch (ex) {
			gitError = ex.toString();
			Logger.error(ex, cc);
			debugger;
		}
		return {
			repositories: repositories ? repositories.map(_ => {
				return {
					id: _.id,
					path: _.path,
					folder: _.folder,
					root: _.root
				};
			}) : undefined,
			error: gitError
		};
	}

	@lspHandler(GetRepoScmStatusRequestType)
	@log()
	async getRepoStatus({
		uri: documentUri,
		includeStaged,
		includeSaved,
		startCommit
	}: GetRepoScmStatusRequest): Promise<GetRepoScmStatusResponse> {
		const cc = Logger.getCorrelationContext();

		const uri = URI.parse(documentUri);

		let branch: string | undefined;
		let file: string | undefined;
		let stagedFiles: string[] = [];
		let savedFiles: string[] = [];
		let modifiedFiles: {
			file: string;
			linesAdded: number;
			linesRemoved: number;
			status: FileStatus;
		}[] = [];
		const authors: CoAuthors = {};
		let totalModifiedLines = 0;

		let commits: { sha: string; info: {}; localOnly: boolean }[] | undefined;
		let gitError;
		let repoPath = "";
		let repoId;
		let remotes: { name: string; url: string }[] | undefined;
		if (uri.scheme === "file") {
			const { git } = SessionContainer.instance();

			try {
				repoPath = (await git.getRepoRoot(uri.fsPath)) || "";
				if (repoPath !== undefined) {
					file = Strings.normalizePath(paths.relative(repoPath, uri.fsPath));
					if (file[0] === "/") {
						file = file.substr(1);
					}

					branch = await git.getCurrentBranch(uri.fsPath);
					if (branch) commits = await git.getCommitsOnBranch(repoPath, branch);

					const repo = await git.getRepositoryByFilePath(uri.fsPath);
					repoId = repo && repo.id;

					const gitRemotes = await git.getRepoRemotes(repoPath);
					remotes = [...Iterables.map(gitRemotes, r => ({ name: r.name, url: r.normalizedUrl }))];

					// if we don't have a starting point to diff against,
					// assume that we want to diff against the parent of
					// the oldest ref, which should be the fork point of this branch
					if (commits && commits.length && !startCommit) {
						startCommit = commits[commits.length - 1].sha + "^";
					}
					if (commits) {
						commits.forEach(commit => {
							// @ts-ignore
							const email = commit.info.email;
							if (email) {
								if (!authors[email]) authors[email] = { commits: 0, stomped: 0 };
								authors[email].commits++;
							}
						});
					}
					modifiedFiles = await git.getNumStat(repoPath, includeSaved, includeStaged, startCommit);
					if (modifiedFiles) {
						modifiedFiles.forEach(file => {
							totalModifiedLines += file.linesAdded + file.linesRemoved;
						});
					}
					const ret1 = await git.getNumStat(repoPath, true, false);
					if (ret1) {
						savedFiles = ret1.map(line => line.file);
					}
					const ret2 = await git.getNumStat(repoPath, false, true);
					if (ret2) {
						stagedFiles = ret2.map(line => line.file);
					}
					if (includeSaved || includeStaged) {
						const ret = await git.getStatus(repoPath, includeSaved);
						if (ret) {
							Object.keys(ret).forEach(file => {
								const found = modifiedFiles?.find(line => line.file === file);
								if (found) {
									found.status = ret[file];
								} else {
									if (ret[file] === FileStatus.deleted) {
										modifiedFiles?.unshift({
											file,
											linesAdded: 0,
											linesRemoved: 0,
											status: ret[file]
										});
									} else {
										modifiedFiles?.push({
											file,
											linesAdded: 0,
											linesRemoved: 0,
											status: ret[file]
										});
									}
								}
							});
						}
					}
					(
						await Promise.all(
							modifiedFiles.map(f => {
								return git.getDiffAuthors(
									repoPath,
									f.file,
									includeSaved,
									includeStaged,
									startCommit
								);
							})
						)
					)
						.filter(Boolean)
						.map(authorList =>
							authorList.forEach(author => {
								if (!authors[author.email]) authors[author.email] = { stomped: 0, commits: 0 };
								authors[author.email].stomped = 1 + authors[author.email].stomped;
							})
						);
				}
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
							repoId,
							repoPath,
							branch,
							modifiedFiles: modifiedFiles || [],
							savedFiles,
							stagedFiles,
							authors,
							commits: [...(commits || [])],
							remotes: remotes || [],
							totalModifiedLines
					  }
					: undefined,
			error: gitError
		};
	}

	@lspHandler(GetFileScmInfoRequestType)
	@log()
	async getFileInfo({ uri: documentUri }: GetFileScmInfoRequest): Promise<GetFileScmInfoResponse> {
		const cc = Logger.getCorrelationContext();

		const uri = URI.parse(documentUri);

		let branch: string | undefined;
		let file: string | undefined;
		let remotes: { name: string; url: string }[] | undefined;
		let rev: string | undefined;

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

					branch = await git.getCurrentBranch(uri.fsPath);
					rev = await git.getFileCurrentRevision(uri.fsPath);

					const gitRemotes = await git.getRepoRemotes(repoPath);
					remotes = [...Iterables.map(gitRemotes, r => ({ name: r.name, url: r.normalizedUrl }))];
				}
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
		let branch: string | undefined;
		let file: string | undefined;
		let remotes: { name: string; url: string }[] | undefined;
		let rev: string | undefined;

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
		let repoId;
		if (uri.scheme === "file") {
			const { git } = SessionContainer.instance();

			try {
				repoPath = await git.getRepoRoot(uri.fsPath);
				if (repoPath !== undefined) {
					file = Strings.normalizePath(paths.relative(repoPath, uri.fsPath));
					if (file[0] === "/") {
						file = file.substr(1);
					}

					branch = await git.getCurrentBranch(uri.fsPath);
					rev = await git.getFileCurrentRevision(uri.fsPath);
					const repo = await git.getRepositoryByFilePath(uri.fsPath);
					repoId = repo && repo.id;

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
							contents: blameContents,
							retryWithTrimmedEndOnFailure: true
						});
						const authorEmails = gitAuthors.map(a => a.email);

						const users = await SessionContainer.instance().users.getByEmails(authorEmails);
						authors = [...Iterables.map(users, u => ({ id: u.id, username: u.username }))];
					}
				}
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
						repoId,
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
