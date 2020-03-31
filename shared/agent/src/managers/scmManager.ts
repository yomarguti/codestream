import * as paths from "path";
import { TextDocument } from "vscode-languageserver-types";
import { URI } from "vscode-uri";
import { Ranges } from "../api/extensions";
import { Logger } from "../logger";
import {
	CoAuthors,
	CreateBranchRequest,
	CreateBranchRequestType,
	CreateBranchResponse,
	FileStatus,
	GetBranchesRequest,
	GetBranchesRequestType,
	GetBranchesResponse,
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
	GetRepoScmStatusesRequest,
	GetRepoScmStatusesRequestType,
	GetRepoScmStatusesResponse,
	GetRepoScmStatusRequest,
	GetRepoScmStatusRequestType,
	GetRepoScmStatusResponse,
	GetReposScmRequest,
	GetReposScmRequestType,
	GetReposScmResponse,
	RepoScmStatus
} from "../protocol/agent.protocol";
import { FileSystem, Iterables, log, lsp, lspHandler, Strings } from "../system";
import { Container, SessionContainer } from "./../container";
import { ReviewsManager } from "./reviewsManager";

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
	async getRepos({}: GetReposScmRequest): Promise<GetReposScmResponse> {
		const cc = Logger.getCorrelationContext();
		let gitError;
		let repositories;
		try {
			const { git } = SessionContainer.instance();
			repositories = Array.from(await git.getRepositories());
		} catch (ex) {
			gitError = ex.toString();
			Logger.error(ex, cc);
			debugger;
		}
		return {
			repositories: repositories
				? repositories.map(_ => {
						return {
							id: _.id,
							path: _.path,
							folder: _.folder,
							root: _.root
						};
				  })
				: undefined,
			error: gitError
		};
	}

	@lspHandler(GetRepoScmStatusesRequestType)
	@log()
	async getRepoStatuses({
		currentUserEmail
	}: GetRepoScmStatusesRequest): Promise<GetRepoScmStatusesResponse> {
		const cc = Logger.getCorrelationContext();
		let gitError;
		let modifiedRepos: RepoScmStatus[] = [];
		try {
			const openRepos = await this.getRepos({});
			const { repositories = [] } = openRepos;
			// @ts-ignore
			modifiedRepos = (
				await Promise.all(
					repositories.map(repo => {
						const response = this.getRepoStatus({
							uri: Strings.pathToFileURL(repo.path),
							startCommit: "local",
							includeStaged: true,
							includeSaved: true,
							currentUserEmail
						});
						return response;
					})
				)
			)
				.filter(Boolean)
				.map(status => {
					return { ...status.scm };
				});
			modifiedRepos.forEach(repo => {
				delete repo.commits;
			});
		} catch (ex) {
			gitError = ex.toString();
			Logger.error(ex, cc);
			debugger;
		}
		return {
			scm: modifiedRepos,
			error: gitError
		};
	}

	@lspHandler(GetBranchesRequestType)
	@log()
	async getBranches({ uri: documentUri }: GetBranchesRequest): Promise<GetBranchesResponse> {
		const cc = Logger.getCorrelationContext();

		const uri = URI.parse(documentUri);
		const { git } = SessionContainer.instance();
		let repoPath = "";
		let result: { branches: string[]; current: string } | undefined = undefined;
		let gitError;

		try {
			repoPath = (await git.getRepoRoot(uri.fsPath)) || "";
			if (repoPath !== undefined) {
				result = await git.getBranches(repoPath);
			}
		} catch (ex) {
			gitError = ex.toString();
			Logger.error(ex, cc);
			debugger;
		}
		return { scm: result || { branches: [], current: "" }, error: gitError };
	}

	@lspHandler(CreateBranchRequestType)
	@log()
	async createBranch({
		uri: documentUri,
		branch
	}: CreateBranchRequest): Promise<CreateBranchResponse> {
		const cc = Logger.getCorrelationContext();

		const uri = URI.parse(documentUri);
		const { git } = SessionContainer.instance();
		let repoPath = "";
		let result = false;
		let gitError;

		try {
			repoPath = (await git.getRepoRoot(uri.fsPath)) || "";
			if (repoPath !== undefined) {
				result = await git.createBranch(repoPath, branch);
			}
		} catch (ex) {
			gitError = ex.toString();
			Logger.error(ex, cc);
			debugger;
		}
		return { scm: { result }, error: gitError };
	}

	@lspHandler(GetRepoScmStatusRequestType)
	@log()
	async getRepoStatus({
		uri: documentUri,
		includeStaged,
		includeSaved,
		startCommit,
		currentUserEmail
	}: GetRepoScmStatusRequest): Promise<GetRepoScmStatusResponse> {
		const cc = Logger.getCorrelationContext();

		const uri = URI.parse(documentUri);

		let branch: string | undefined;
		let file: string | undefined;
		let stagedFiles: string[] = [];
		let savedFiles: string[] = [];
		let modifiedFiles: {
			oldFile: string;
			file: string;
			linesAdded: number;
			linesRemoved: number;
			status: FileStatus;
			statusX?: FileStatus;
			statusY?: FileStatus;
		}[] = [];
		const authorMap: any = {};
		const authors: CoAuthors[] = [];
		let totalModifiedLines = 0;

		let commits: { sha: string; info: any; localOnly: boolean }[] | undefined;
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
					// assume that we want to diff against either the first
					// commit that isn't mine, or failing that, the parent of
					// the oldest ref, which should be the fork point of this branch
					if (commits && commits.length && !startCommit) {
						const notMine = commits.find(
							commit => commit.info && commit.info.email !== currentUserEmail
						);
						if (notMine) startCommit = notMine.sha;
						else startCommit = commits[commits.length - 1].sha + "^";
					}

					// if we only want to show local work, then we should
					// start at the first pushed branch
					if (startCommit === "local") {
						const latestPushed = commits?.find(commit => !commit.localOnly);
						startCommit = latestPushed?.sha;
					}

					if (commits) {
						commits.forEach(commit => {
							// @ts-ignore
							const email = commit.info.email;
							if (email) {
								if (!authorMap[email]) authorMap[email] = { commits: 0, stomped: 0 };
								authorMap[email].commits++;
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
						const statusByFile = await git.getStatus(repoPath, includeSaved);
						if (statusByFile) {
							Object.keys(statusByFile).forEach(file => {
								const found = modifiedFiles?.find(line => line.file === file);
								if (found) {
									Object.assign(found, statusByFile[file]);
								} else {
									if (statusByFile[file].status === FileStatus.deleted) {
										modifiedFiles?.unshift({
											oldFile: file,
											file,
											linesAdded: 0,
											linesRemoved: 0,
											...statusByFile[file]
										});
									} else {
										modifiedFiles?.push({
											oldFile: file,
											file,
											linesAdded: 0,
											linesRemoved: 0,
											...statusByFile[file]
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
								if (!authorMap[author.email]) authorMap[author.email] = { stomped: 0, commits: 0 };
								authorMap[author.email].stomped = 1 + authorMap[author.email].stomped;
							})
						);
				}
				Object.keys(authorMap).forEach(email => {
					authors.push({
						email,
						stomped: authorMap[email].stomped,
						commits: authorMap[email].commits
					});
				});
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
							startCommit: startCommit || "",
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
					try {
						rev = await git.getFileCurrentRevision(uri.fsPath);
					} catch (ex) {
						// this is when we're looking up a directory not a file,
						// getFileCurrentRevision will fail
					}

					const gitRemotes = await git.getRepoRemotes(repoPath);
					remotes = [...Iterables.map(gitRemotes, r => ({ name: r.name, url: r.normalizedUrl }))];

					const repo = await git.getRepositoryByFilePath(uri.fsPath);
					repoId = repo && repo.id;
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
							repoId,
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
	getRangeInfo(request: GetRangeScmInfoRequest): Promise<GetRangeScmInfoResponse> {
		if (request.uri.startsWith("codestream-diff://")) {
			return this.getDiffRangeInfo(request);
		} else {
			return this.getFileRangeInfo(request);
		}
	}

	private async getDiffRangeInfo({
		uri: documentUri,
		range,
		dirty,
		contents,
		skipBlame
	}: GetRangeScmInfoRequest): Promise<GetRangeScmInfoResponse> {
		const { git, reviews } = SessionContainer.instance();
		range = Ranges.ensureStartBeforeEnd(range);

		const { reviewId, repoId, version, path } = ReviewsManager.parseUri(documentUri);
		const repo = await git.getRepositoryById(repoId);
		if (repo == null) throw new Error(`Could not find repo with ID ${repoId}`);

		const uri = URI.parse(documentUri);
		if (contents == null) {
			const reviewContents = await reviews.getContents({ reviewId, repoId, path });
			const versionContents = (reviewContents as any)[version] as string;
			const document = TextDocument.create(uri.toString(), "codestream", 0, versionContents);
			contents = document.getText(range);
		}

		const review = await reviews.getById(reviewId);
		const changeset = review.reviewChangesets.find(c => c.repoId === repoId);
		if (!changeset) throw new Error(`Could not find changeset with repoId ${repoId}`);

		const gitRemotes = await repo.getRemotes();
		const remotes = [...Iterables.map(gitRemotes, r => ({ name: r.name, url: r.normalizedUrl }))];
		const diffs = await reviews.getDiffs(reviewId, repoId);
		return {
			uri: uri.toString(),
			range: range,
			contents: contents!,
			scm: {
				file: path,
				repoPath: repo.path,
				repoId,
				revision: diffs.latestCommitSha,
				authors: [],
				remotes,
				branch: changeset.branch
			},
			error: undefined
		};
	}

	private async getFileRangeInfo({
		uri: documentUri,
		range,
		dirty,
		contents,
		skipBlame
	}: GetRangeScmInfoRequest): Promise<GetRangeScmInfoResponse> {
		const cc = Logger.getCorrelationContext();
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
