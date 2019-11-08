"use strict";
import { Response } from "node-fetch";
import * as paths from "path";
import * as qs from "querystring";
import { URI } from "vscode-uri";
import { SessionContainer } from "../container";
import { GitRemote } from "../git/models/remote";
import { GitRepository } from "../git/models/repository";
import { Logger } from "../logger";
import { Markerish, MarkerLocationManager } from "../managers/markerLocationManager";
import { MAX_RANGE_VALUE } from "../markerLocation/calculator";
import {
	CreateThirdPartyCardRequest, DocumentMarker,
	FetchThirdPartyBoardsRequest,
	FetchThirdPartyBoardsResponse,
	GitLabBoard,
	GitLabCreateCardRequest,
	GitLabCreateCardResponse
} from "../protocol/agent.protocol";
import { CodemarkType, CSGitLabProviderInfo, CSLocationArray, CSReferenceLocation } from "../protocol/api.protocol";
import { log, lspProvider, Strings } from "../system";
import {
	getRemotePath,
	PullRequestComment,
	ThirdPartyIssueProviderBase	
} from "./provider";

interface GitLabProject {
	path_with_namespace: any;
	id: string;
	path: string;
	issues_enabled: boolean;
}

interface GitLabUser {
	id: string;
	name: string;
}

@lspProvider("gitlab")
export class GitLabProvider extends ThirdPartyIssueProviderBase<CSGitLabProviderInfo> {
	private _gitlabUserId: string | undefined;
	private _projectsByRemotePath = new Map<string, GitLabProject>();

	get displayName() {
		return "GitLab";
	}

	get name() {
		return "gitlab";
	}

	get headers() {
		return {
			Authorization: `Bearer ${this.accessToken}`
		};
	}

	protected isPRApiCompatible(): Promise<boolean> {
		return Promise.resolve(true);
	}

	async onConnected() {
		this._gitlabUserId = await this.getMemberId();
		this._projectsByRemotePath = new Map<string, GitLabProject>();
	}

	@log()
	async getBoards(request: FetchThirdPartyBoardsRequest): Promise<FetchThirdPartyBoardsResponse> {
		await this.ensureConnected();
		const openProjects = await this.getOpenProjectsByRemotePath();

		let boards: GitLabBoard[];
		if (openProjects.size > 0) {
			const gitLabProjects = Array.from(openProjects.values());
			boards = gitLabProjects
				.filter(p => p.issues_enabled)
				.map(p => ({
					id: p.id,
					name: p.path_with_namespace,
					path: p.path,
					singleAssignee: true // gitlab only allows a single assignee per issue (at least it only shows one in the UI)
				}));
		} else {
			let gitLabProjects: { [key: string]: string }[] = [];
			try {
				let apiResponse = await this.get<{ [key: string]: string }[]>(
					`/projects?min_access_level=20&with_issues_enabled=true`
				);
				gitLabProjects = apiResponse.body;

				let nextPage: string | undefined;
				while ((nextPage = this.nextPage(apiResponse.response))) {
					apiResponse = await this.get<{ [key: string]: string }[]>(nextPage);
					gitLabProjects = gitLabProjects.concat(apiResponse.body);
				}
			} catch (err) {
				Logger.error(err);
				debugger;
			}
			boards = gitLabProjects.map(p => {
				return {
					...p,
					id: p.id,
					name: p.path_with_namespace,
					path: p.path,
					singleAssignee: true // gitlab only allows a single assignee per issue (at least it only shows one in the UI)
				};
			});
		}

		return {
			boards
		};
	}

	private async getOpenProjectsByRemotePath() {
		const { git } = SessionContainer.instance();
		const gitRepos = await git.getRepositories();
		const openProjects = new Map<string, GitLabProject>();

		for (const gitRepo of gitRepos) {
			const remotes = await git.getRepoRemotes(gitRepo.path);
			for (const remote of remotes) {
				if (remote.domain === "gitlab.com" && !openProjects.has(remote.path)) {
					let gitlabProject = this._projectsByRemotePath.get(remote.path);

					if (!gitlabProject) {
						try {
							const response = await this.get<GitLabProject>(
								`/projects/${encodeURIComponent(remote.path)}`
							);
							gitlabProject = {
								...response.body,
								path: gitRepo.path
							};
							this._projectsByRemotePath.set(remote.path, gitlabProject);
						} catch (err) {
							Logger.error(err);
							debugger;
						}
					}

					if (gitlabProject) {
						openProjects.set(remote.path, gitlabProject);
					}
				}
			}
		}
		return openProjects;
	}

	@log()
	async createCard(request: CreateThirdPartyCardRequest) {
		await this.ensureConnected();

		const data = request.data as GitLabCreateCardRequest;
		const card: { [key: string]: any } = {
			title: data.title,
			description: data.description
		};
		if (data.assignee) {
			// GitLab allows for multiple assignees in the API, but only one appears in the UI
			card.assignee_ids = [data.assignee.id];
		}
		const response = await this.post<{}, GitLabCreateCardResponse>(
			`/projects/${encodeURIComponent(data.repoName)}/issues?${qs.stringify(card)}`,
			{}
		);
		return { ...response.body, url: response.body.web_url };
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
		await this.ensureConnected();

		const response = await this.get<GitLabUser[]>(`/projects/${request.boardId}/users`);
		return { users: response.body.map(u => ({ ...u, displayName: u.name })) };
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

		const { git, session } = SessionContainer.instance();

		const repo = await git.getRepositoryByFilePath(uri.fsPath);
		if (repo === undefined) return documentMarkers;

		const comments = await this._getCommentsForPath(uri.fsPath, repo);
		if (comments === undefined) return documentMarkers;

		const commentsById: { [id: string]: PullRequestComment } = Object.create(null);
		const markersByCommit = new Map<string, Markerish[]>();

		let line;
		let rev;
		for (const c of comments) {
			const outdated = !(await git.isValidReference(repo.path, c.commit));

			rev = outdated ? c.originalCommit! : c.commit;

			let markers = markersByCommit.get(rev);
			if (markers === undefined) {
				markers = [];
				markersByCommit.set(rev, markers);
			}

			line = outdated ? c.originalLine! : c.line;
			commentsById[c.id] = c;
			const referenceLocations: CSReferenceLocation[] = [];
			if (line >= 0) {
				referenceLocations.push({
					commitHash: rev,
					location: [line, 1, line, MAX_RANGE_VALUE, undefined] as CSLocationArray,
					flags: {
						canonical: true
					}
				});
			}
			markers.push({
				id: c.id,
				referenceLocations
			});
		}

		const locations = await MarkerLocationManager.computeCurrentLocations(
			uri,
			revision!,
			markersByCommit
		);

		const teamId = session.teamId;

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
						icon: "gitlab"
					},
					subhead: `#${comment.pullRequest.id}`,
					actions: [
						{
							label: "Open Note",
							uri: comment.url
						},
						{
							label: `Open Merge Request #${comment.pullRequest.id}`,
							uri: comment.pullRequest.url
						}
					]
				},
				range: {
					start: {
						line: location.lineStart - 1,
						character: location.colStart - 1
					},
					end: {
						line: location.lineEnd - 1,
						character: location.colEnd - 1
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

	private _isMatchingRemotePredicate = (r: GitRemote) => r.domain === "gitlab.com";
	protected getIsMatchingRemotePredicate() {
		return this._isMatchingRemotePredicate;
	}

	@log()
	private async _getCommentsForPath(
		filePath: string,
		repo: GitRepository
	): Promise<PullRequestComment[] | undefined> {
		const cc = Logger.getCorrelationContext();

		try {
			const remotePath = await getRemotePath(
				repo,
				this.getIsMatchingRemotePredicate(),
				this._projectsByRemotePath
			);
			if (remotePath == null) return undefined;

			const relativePath = Strings.normalizePath(paths.relative(repo.path, filePath));
			const cacheKey = `${repo.path}|${relativePath}`;

			const cachedComments = this._commentsByRepoAndPath.get(cacheKey);
			if (cachedComments !== undefined && cachedComments.expiresAt > new Date().getTime()) {
				// NOTE: Keep this await here, so any errors are caught here
				return await cachedComments.comments;
			}

			const commentsPromise = this._getCommentsForPathCore(
				filePath,
				relativePath,
				remotePath
			);
			this._commentsByRepoAndPath.set(cacheKey, {
				expiresAt: new Date().setMinutes(new Date().getMinutes() + 30),
				comments: commentsPromise
			});

			// Since we aren't cached, we want to just kick of the request to get the comments (which will fire a notification)
			// This could probably be enhanced to wait for the commentsPromise for a short period of time (maybe 1s?) to see if it will complete, to avoid the notification roundtrip for fast requests
			return undefined;
		} catch (ex) {
			Logger.error(ex, cc);
			return undefined;
		}
	}

	private async _getCommentsForPathCore(
		filePath: string,
		relativePath: string,
		remotePath: string
	): Promise<PullRequestComment[]> {
		const prs = await this._getPullRequests(remotePath);

		const comments = (await Promise.all(
			prs.map(pr => this._getPullRequestComments(remotePath, pr, relativePath))
		)).reduce((group, current) => group.concat(current), []);


		// If we have any comments, fire a notification
		if (comments.length !== 0) {
			SessionContainer.instance().documentMarkers.fireDidChangeDocumentMarkers(
				URI.file(filePath).toString(),
				"codemarks"
			);
		}

		return comments;
	}

	private async _getPullRequests(remotePath: string) {
		let prs: GitLabPullRequest[] = [];

		try {
			let apiResponse = await this.get<GitLabPullRequest[]>(
				`/projects/${encodeURIComponent(remotePath)}/merge_requests?state=merged`
			);
			prs = apiResponse.body;

			let nextPage: string | undefined;
			while ((nextPage = this.nextPage(apiResponse.response))) {
				apiResponse = await this.get<GitLabPullRequest[]>(nextPage);
				prs = prs.concat(apiResponse.body);
			}
		} catch (ex) {
			Logger.error(ex);
		}

		return prs;
	}

	private async _getPullRequestComments(remotePath: string, pr: GitLabPullRequest, relativePath: string): Promise<PullRequestComment[]> {
		let gitLabComments: GitLabPullRequestComment[] = [];

		try {
			let apiResponse = await this.get<GitLabPullRequestComment[]>(
				`/projects/${encodeURIComponent(remotePath)}/merge_requests/${pr.iid}/notes`
			);
			gitLabComments = apiResponse.body;

			let nextPage: string | undefined;
			while ((nextPage = this.nextPage(apiResponse.response))) {
				apiResponse = await this.get<GitLabPullRequestComment[]>(nextPage);
				gitLabComments = gitLabComments.concat(apiResponse.body);
			}
		} catch (ex) {
			Logger.error(ex);
		}

		return gitLabComments
			.filter(c => !c.system && c.position != null && c.position.new_path === relativePath)
			.map(glComment => {
				return {
					id: glComment.id.toString(),
					author: {
						id: glComment.author.id.toString(),
						nickname: glComment.author.name
					},
					path: glComment.position.new_path,
					text: glComment.body,
					code: "",
					commit: glComment.position.head_sha,
					originalCommit: glComment.position.base_sha,
					line: glComment.position.new_line,
					originalLine: glComment.position.old_line,
					url: `${pr.web_url}#note_${glComment.id}`,
					createdAt: new Date(glComment.created_at).getTime(),
					pullRequest: {
						id: pr.iid,
						url: pr.web_url
					}
				};
			});
	}
}

interface GitLabPullRequest {
	id: number;
	iid: number;
	title: string;
	web_url: string;
}

interface GitLabPullRequestComment {
	id: number;
	type: string;
	body: string;
	attachment?: any;
	author: GitLabPullRequestCommentAuthor;
	created_at: string;
	updated_at: string;
	system: boolean;
	noteable_id: number;
	noteable_type: string;
	position: GitLabPullRequestCommentPosition;
	resolvable: boolean;
	resolved: boolean;
	resolved_by?: string;
	noteable_iid: number;
}

interface GitLabPullRequestCommentAuthor {
	id: number;
	name: string;
	username: string;
	state: string;
	avatar_url: string;
	web_url: string;
}

interface GitLabPullRequestCommentPosition {
	base_sha: string;
	start_sha: string;
	head_sha: string;
	old_path: string;
	new_path: string;
	position_type: string;
	old_line?: number;
	new_line: number;
}
