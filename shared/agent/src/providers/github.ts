"use strict";
import { GitRemote } from "git/gitService";
import { GraphQLClient } from "graphql-request";
import { Response } from "node-fetch";
import * as paths from "path";
import { URI } from "vscode-uri";
import { SessionContainer } from "../container";
import { Logger } from "../logger";
import { Markerish, MarkerLocationManager } from "../managers/markerLocationManager";
import {
	CreateThirdPartyCardRequest,
	DocumentMarker,
	FetchThirdPartyBoardsRequest,
	FetchThirdPartyBoardsResponse,
	GitHubBoard,
	GitHubCreateCardRequest,
	GitHubCreateCardResponse,
	GitHubUser
} from "../protocol/agent.protocol";
import { CodemarkType, CSGitHubProviderInfo, CSLocationArray } from "../protocol/api.protocol";
import { Arrays, Functions, log, lspProvider, Strings } from "../system";
import {
	getOpenedRepos,
	getRepoRemotePaths,
	PullRequestComment,
	ThirdPartyProviderBase,
	ThirdPartyProviderSupportsIssues,
	ThirdPartyProviderSupportsPullRequests
} from "./provider";

interface GitHubRepo {
	id: string;
	full_name: string;
	path: string;
	has_issues: boolean;
}

const diffHunkRegex = /^@@ -([\d]+)(?:,([\d]+))? \+([\d]+)(?:,([\d]+))? @@/;

@lspProvider("github")
export class GitHubProvider extends ThirdPartyProviderBase<CSGitHubProviderInfo>
	implements ThirdPartyProviderSupportsIssues, ThirdPartyProviderSupportsPullRequests {
	private _githubUserId: string | undefined;
	private _knownRepos = new Map<string, GitHubRepo>();

	get displayName() {
		return "GitHub";
	}

	get name() {
		return "github";
	}

	get headers() {
		return {
			Authorization: `token ${this.accessToken}`,
			"user-agent": "CodeStream",
			Accept: "application/vnd.github.v3+json, application/vnd.github.inertia-preview+json"
		};
	}

	protected isPRApiCompatible(): Promise<boolean> {
		return Promise.resolve(true);
	}

	private _client: GraphQLClient | undefined;
	private get client(): GraphQLClient {
		if (this._client === undefined) {
			if (!this.accessToken) {
				throw new Error("No GitHub personal access token could be found");
			}

			this._client = new GraphQLClient(`${this.baseUrl}/graphql`, {
				headers: {
					Authorization: `Bearer ${this.accessToken}`
				}
			});
		}
		return this._client;
	}

	async onConnected() {
		this._githubUserId = await this.getMemberId();
		this._knownRepos = new Map<string, GitHubRepo>();
	}

	@log()
	async getBoards(request: FetchThirdPartyBoardsRequest): Promise<FetchThirdPartyBoardsResponse> {
		void (await this.ensureConnected());

		const openRepos = await getOpenedRepos<GitHubRepo>(
			r => r.domain === "github.com",
			p => this.get<GitHubRepo>(`/repos/${p}`),
			this._knownRepos
		);

		let boards: GitHubBoard[];
		if (openRepos.size > 0) {
			const gitHubRepos = Array.from(openRepos.values());
			boards = gitHubRepos
				.filter(r => r.has_issues)
				.map(r => ({
					id: r.id,
					name: r.full_name,
					apiIdentifier: r.full_name,
					path: r.path
				}));
		} else {
			let gitHubRepos: { [key: string]: string }[] = [];
			try {
				let apiResponse = await this.get<{ [key: string]: string }[]>(`/user/repos`);
				gitHubRepos = apiResponse.body;

				let nextPage: string | undefined;
				while ((nextPage = this.nextPage(apiResponse.response))) {
					apiResponse = await this.get<{ [key: string]: string }[]>(nextPage);
					gitHubRepos = gitHubRepos.concat(apiResponse.body);
				}
			} catch (err) {
				Logger.error(err);
				debugger;
			}
			gitHubRepos = gitHubRepos.filter(r => r.has_issues);
			boards = gitHubRepos.map(repo => {
				return {
					...repo,
					id: repo.id,
					name: repo.full_name,
					apiIdentifier: repo.full_name
				};
			});
		}

		return {
			boards
		};
	}

	@log()
	async createCard(request: CreateThirdPartyCardRequest) {
		void (await this.ensureConnected());

		const data = request.data as GitHubCreateCardRequest;
		const response = await this.post<{}, GitHubCreateCardResponse>(
			`/repos/${data.repoName}/issues`,
			{
				title: data.title,
				body: data.description,
				assignees: (data.assignees! || []).map(a => a.login)
			}
		);
		return { ...response.body, url: response.body.html_url };
	}

	private async getMemberId() {
		const userResponse = await this.get<{ id: string; [key: string]: any }>(`/user`);

		return userResponse.body.id;
	}

	private nextPage(response: Response): string | undefined {
		const linkHeader = response.headers.get("Link") || "";
		const links = linkHeader.split(",");
		for (const link of links) {
			const [rawUrl, rawRel] = link.split(";");
			const url = rawUrl.trim();
			const rel = rawRel.trim();
			if (rel === `rel="next"`) {
				const baseUrl = this.baseUrl;
				return url.substring(1, url.length - 1).replace(baseUrl, "");
			}
		}
		return undefined;
	}

	@log()
	async getAssignableUsers(request: { boardId: string }) {
		void (await this.ensureConnected());

		const { body } = await this.get<GitHubUser[]>(`/repos/${request.boardId}/collaborators`);
		return { users: body.map(u => ({ ...u, id: u.id, displayName: u.login })) };
	}

	@log()
	async getPullRequestDocumentMarkers({
		uri,
		revision,
		repoId,
		streamId
	}: {
		uri: URI;
		revision: string | undefined;
		repoId: string | undefined;
		streamId: string;
	}): Promise<DocumentMarker[]> {
		void (await this.ensureConnected());

		const documentMarkers: DocumentMarker[] = [];

		if (!(await this.isPRApiCompatible())) return documentMarkers;

		const comments = await this._getCommentsForPath(uri.fsPath);
		if (comments === undefined) return documentMarkers;

		const teamId = SessionContainer.instance().session.teamId;

		const commentsById: { [id: string]: PullRequestComment } = Object.create(null);
		const markersByCommit = new Map<string, Markerish[]>();

		let line;
		let rev;
		for (const c of comments) {
			rev = c.outdated ? c.originalCommit! : c.commit;
			let markers = markersByCommit.get(rev);
			if (markers === undefined) {
				markers = [];
				markersByCommit.set(rev, markers);
			}

			line = c.outdated ? c.originalLine! : c.line;
			commentsById[c.id] = c;
			markers.push({
				id: c.id,
				locationWhenCreated: [line, 1, line + 1, 1, undefined] as CSLocationArray
			});
		}

		const locations = await MarkerLocationManager.computeCurrentLocations(
			uri.fsPath,
			revision!,
			markersByCommit
		);

		for (const [id, location] of Object.entries(locations.locations)) {
			const comment = commentsById[id];

			documentMarkers.push({
				id: id,
				codemarkId: undefined,
				fileUri: uri.toString(),
				fileStreamId: streamId,
				// postId: undefined!,
				// postStreamId: undefined!,
				repoId: repoId!,
				teamId: teamId,
				file: uri.fsPath,
				// commitHashWhenCreated: revision!,
				// locationWhenCreated: MarkerLocation.toArray(location),
				modifiedAt: new Date(comment.createdAt).getTime(),
				code: "",

				createdAt: new Date(comment.createdAt).getTime(),
				creatorId: comment.author.id,
				creatorName: comment.author.nickname,
				externalContent: {
					provider: {
						name: this.displayName,
						icon: "mark-github"
					},
					subhead: `#${comment.pullRequest.id}`,
					actions: [
						{
							label: "Open Comment",
							uri: comment.url
						},
						{
							label: `Open Pull Request #${comment.pullRequest.id}`,
							uri: comment.pullRequest.url
						}
					]
				},
				range: {
					start: {
						line: location.lineStart - 1,
						character: 0
					},
					end: {
						line: location.lineEnd - 1,
						character: 0
					}
				},
				location: location,
				summary: comment.text,
				summaryMarkdown: `\n\n${Strings.escapeMarkdown(comment.text)}`,
				type: CodemarkType.Comment
			});
		}

		return documentMarkers;
	}

	private _commentsByRepoAndPath = new Map<
		string,
		{ expiresAt: number; comments: Promise<PullRequestComment[]> }
	>();
	private _prsByRepo = new Map<string, { expiresAt: number; prs: Promise<GitHubPullRequest[]> }>();

	private _isMatchingRemotePredicate = (r: GitRemote) => r.domain === "github.com";
	protected getIsMatchingRemotePredicate() {
		return this._isMatchingRemotePredicate;
	}

	@log()
	private async _getCommentsForPath(filePath: string): Promise<PullRequestComment[] | undefined> {
		const cc = Logger.getCorrelationContext();

		try {
			const { remotePath, repoPath } = await getRepoRemotePaths(
				filePath,
				this.getIsMatchingRemotePredicate(),
				this._knownRepos
			);
			if (remotePath == null || repoPath == null) return undefined;

			const relativePath = Strings.normalizePath(paths.relative(repoPath, filePath));
			const cacheKey = `${repoPath}|${relativePath}`;

			const cachedComments = this._commentsByRepoAndPath.get(cacheKey);
			if (cachedComments !== undefined && cachedComments.expiresAt > new Date().getTime()) {
				return cachedComments.comments;
			}

			const commentsPromise = this._getCommentsForPathCore(relativePath, remotePath, repoPath);
			this._commentsByRepoAndPath.set(cacheKey, {
				expiresAt: new Date().setMinutes(new Date().getMinutes() + 30),
				comments: commentsPromise
			});

			const comments = await commentsPromise;

			return comments;
		} catch (ex) {
			Logger.error(ex, cc);
			return undefined;
		}
	}

	private async _getCommentsForPathCore(
		relativePath: string,
		remotePath: string,
		repoPath: string
	): Promise<PullRequestComment[]> {
		let prs: GitHubPullRequest[];

		const cachedPRs = this._prsByRepo.get(repoPath);

		if (cachedPRs !== undefined && cachedPRs.expiresAt > new Date().getTime()) {
			prs = await cachedPRs.prs;
		} else {
			const [owner, repo] = remotePath.split("/");

			const prsPromise = this._getPullRequests(owner, repo);
			this._prsByRepo.set(repoPath, {
				expiresAt: new Date().setMinutes(new Date().getMinutes() + 30),
				prs: prsPromise
			});

			prs = await prsPromise;
		}

		const comments: PullRequestComment[] = [];

		for (const pr of prs) {
			if (pr.reviewThreads.totalCount === 0) continue;

			let comment: PullRequestComment;
			let prComment;
			for (const rt of pr.reviewThreads.nodes) {
				if (rt.comments.totalCount === 0) continue;

				prComment = rt.comments.nodes[0];
				if (prComment.path !== relativePath) continue;

				comment = {
					id: rt.id,
					author: {
						id: prComment.author.login,
						nickname: prComment.author.login
					},
					path: prComment.path,
					text: prComment.bodyText,
					code: "",
					commit: prComment.outdated ? prComment.originalCommit.oid : prComment.commit.oid,
					originalCommit: prComment.originalCommit.oid,
					line: prComment.position || prComment.originalPosition,
					originalLine: prComment.originalPosition,
					url: prComment.url,
					createdAt: new Date(prComment.createdAt).getTime(),
					pullRequest: {
						id: pr.number,
						url: pr.url
					},
					diffHunk: prComment.diffHunk,
					outdated: prComment.outdated
				};

				const diffLines = comment.diffHunk!.split("\n");
				// Get rid of the hunk header
				diffLines.shift();

				// Since we can't trust the positions from GitHub, we "calc" them by counting the number of original/new lines in the diff hunk
				// Because the diff hunk that GitHub returns always ends at the commented on line
				const originalPosition =
					Arrays.count(diffLines, l => l.startsWith("-") || l.startsWith(" ")) - 1;
				const position = Arrays.count(diffLines, l => l.startsWith("+") || l.startsWith(" ")) - 1;

				// Get the code from the diff hunk
				comment.code = diffLines[diffLines.length - 1] || "";
				if (comment.code) {
					// Strip off the diff hunk +/-
					comment.code = comment.code.substr(1);
				}

				// Since the provided line numbers are offsets in the diff hunk, add the diff hunk line to the offset line
				const match = diffHunkRegex.exec(comment.diffHunk!);
				if (match == null) continue;

				const [, originalLine, , line] = match;

				comment.originalLine! = Number(originalLine) + originalPosition;
				comment.line = Number(line) + position;

				comments.push(comment);
			}
		}

		return comments;
	}

	private async _getPullRequests(owner: string, repo: string) {
		const prs = [];

		try {
			let response;
			do {
				response = await this.prQuery(owner, repo, response && response.pageInfo.endCursor);
				if (response === undefined) break;

				prs.push(...response.nodes);
			} while (response.pageInfo.hasNextPage);
		} catch (ex) {
			Logger.error(ex);
		}

		return prs;
	}

	private _prQueryRateLimit:
		| {
				limit: number;
				cost: number;
				remaining: number;
				resetAt: Date;
		  }
		| undefined;

	async prQuery(
		owner: string,
		repo: string,
		cursor?: string
	): Promise<GitHubPullRequests | undefined> {
		const cc = Logger.getCorrelationContext();

		// If we are or will be over the rate limit, wait until it gets reset
		if (
			this._prQueryRateLimit !== undefined &&
			this._prQueryRateLimit.remaining - this._prQueryRateLimit.cost < 0
		) {
			// TODO: Probably should send a notification to the webview here

			// If we are currently paging, just give up and return what we have
			if (cursor === undefined) return undefined;

			await Functions.wait(this._prQueryRateLimit.resetAt.getTime() - new Date().getTime());
		}

		// TODO: Need to page if there are more than 100 review threads
		try {
			const query = `query pr($owner: String!, $repo: String!) {
				repository(name: $repo, owner: $owner${cursor ? `after: $cursor` : ""}) {
					pullRequests(states: MERGED, first: 100, orderBy: { field: UPDATED_AT, direction: DESC }) {
						totalCount
						pageInfo {
							startCursor
							endCursor
							hasNextPage
						}
						nodes {
							title
							number
							url
							reviewThreads(first: 100) {
								totalCount
								pageInfo {
									startCursor
									endCursor
									hasNextPage
								}
								nodes {
									id
									isResolved
									comments(first: 1) {
										totalCount
										nodes {
											author {
												login
											}
											bodyText
											createdAt
											url
											path
											commit {
												oid
											}
											originalCommit {
												oid
											}
											originalPosition
											diffHunk
											position
											outdated
											state
										}
									}
								}
							}
						}
					}
				},
				rateLimit {
					limit
					cost
					remaining
					resetAt
				}
			}`;

			const rsp = await this.client.request<GetPullRequestsResponse>(query, {
				owner: owner,
				repo: repo,
				cursor: cursor
			});

			this._prQueryRateLimit = {
				cost: rsp.rateLimit.cost,
				limit: rsp.rateLimit.limit,
				remaining: rsp.rateLimit.remaining,
				resetAt: new Date(rsp.rateLimit.resetAt)
			};

			return rsp.repository.pullRequests;
		} catch (ex) {
			Logger.error(ex, cc);

			// If we are currently paging, just give up and return what we have
			if (cursor !== undefined) return undefined;

			throw ex;
		}
	}
}

interface GitHubPullRequest {
	title: string;
	number: number;
	url: string;
	reviewThreads: {
		totalCount: number;
		pageInfo: {
			startCursor: string;
			endCursor: string;
			hasNextPage: boolean;
		};
		nodes: {
			id: string;
			isResolved: boolean;
			comments: {
				totalCount: number;
				nodes: {
					author: {
						login: string;
					};
					bodyText: string;
					createdAt: string;
					url: string;
					path: string;
					commit: {
						oid: string;
					};
					originalCommit: {
						oid: string;
					};
					originalPosition: number;
					diffHunk: string;
					position: number | null;
					outdated: boolean;
				}[];
			};
		}[];
	};
}

interface GitHubPullRequests {
	totalCount: number;
	pageInfo: {
		startCursor: string;
		endCursor: string;
		hasNextPage: boolean;
	};
	nodes: GitHubPullRequest[];
}

interface GetPullRequestsResponse {
	repository: {
		pullRequests: GitHubPullRequests;
	};
	rateLimit: {
		limit: number;
		cost: number;
		remaining: number;
		resetAt: string;
	};
}
