"use strict";
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
import { Arrays, log, lspProvider, Strings } from "../system";
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
	private _isPRApiCompatible: boolean | undefined;

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

	get isEnterprise() {
		return this.name === "github_enterprise";
	}

	get isPRApiCompatible() {
		return this._isPRApiCompatible;
	}

	private async _checkEnterpriseVersionPRCompatibility() {
		const response = await this.get<{ installed_version: string }>("/meta");

		const [major, minor] = response.body.installed_version.split(".").map(Number);
		return major > 2 || (major === 2 && minor >= 15);
	}

	private _client: GraphQLClient | undefined;
	private get client(): GraphQLClient {
		if (this._client === undefined) {
			if (!this.accessToken) {
				throw new Error("No GitHub personal access token could be found");
			}

			const baseUrl = this.isEnterprise ? `${this.getConfig().host}/api` : "https://api.github.com";

			this._client = new GraphQLClient(`${baseUrl}/graphql`, {
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

		if (this.isPRApiCompatible == null) {
			this._isPRApiCompatible = await this._checkEnterpriseVersionPRCompatibility();
		}

		if (!this.isPRApiCompatible) return [];

		const documentMarkers: DocumentMarker[] = [];

		const comments = await this.getCommentsForPath(uri.fsPath);
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
		{ expiresAt: number; comments: PullRequestComment[] }
	>();
	private _prsByRepo = new Map<string, { expiresAt: number; prs: GitHubPullRequest[] }>();

	@log()
	private async getCommentsForPath(filePath: string): Promise<PullRequestComment[] | undefined> {
		const cc = Logger.getCorrelationContext();

		try {
			const { remotePath, repoPath } = await getRepoRemotePaths(
				filePath,
				r => {
					if (this.isEnterprise) {
						const configDomain = URI.parse(this.getConfig().host).authority;
						return configDomain === r.domain;
					}

					return r.domain === "github.com";
				},
				this._knownRepos
			);
			if (remotePath == null || repoPath == null) return undefined;

			const relativePath = Strings.normalizePath(paths.relative(repoPath, filePath));
			const cacheKey = `${repoPath}|${relativePath}`;

			const cachedComments = this._commentsByRepoAndPath.get(cacheKey);
			if (cachedComments !== undefined && cachedComments.expiresAt > new Date().getTime()) {
				return cachedComments.comments;
			}

			let prs: GitHubPullRequest[];

			const cachedPRs = this._prsByRepo.get(repoPath);

			if (cachedPRs !== undefined && cachedPRs.expiresAt > new Date().getTime()) {
				prs = cachedPRs.prs;
			} else {
				prs = [];

				const [owner, repo] = remotePath.split("/");

				let pullRequestsResponse;
				do {
					pullRequestsResponse = await this.prQuery(owner, repo);
					prs.push(...pullRequestsResponse!.nodes);
				} while (pullRequestsResponse!.pageInfo.hasNextPage);

				this._prsByRepo.set(repoPath, {
					expiresAt: new Date().setMinutes(new Date().getMinutes() + 30),
					prs: prs
				});
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
					if (match == null) return undefined;

					const [, originalLine, , line] = match;

					comment.originalLine! = Number(originalLine) + originalPosition;
					comment.line = Number(line) + position;

					comments.push(comment);
				}
			}

			this._commentsByRepoAndPath.set(cacheKey, {
				expiresAt: new Date().setMinutes(new Date().getMinutes() + 30),
				comments: comments
			});

			return comments;
		} catch (ex) {
			Logger.error(ex, cc);
			return undefined;
		}
	}

	async prQuery(
		owner: string,
		repo: string,
		cursor?: string
	): Promise<GitHubPullRequests | undefined> {
		const cc = Logger.getCorrelationContext();

		// TODO: Need to page if there are more than 100 review threads
		try {
			const query = `query pr($owner: String!, $repo: String!) {
				repository(name: $repo, owner: $owner${cursor ? `after: ${cursor}` : ""}) {
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
				}
			}`;

			const rsp = await this.client.request<GetPullRequestsResponse>(query, {
				owner: owner,
				repo: repo
			});
			return rsp.repository.pullRequests;
		} catch (ex) {
			Logger.error(ex, cc);
			return undefined;
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
}
