"use strict";
import { Response } from "node-fetch";
import * as qs from "querystring";
import { Container } from "../container";
import { Logger } from "../logger";
import {
	CreateThirdPartyCardRequest,
	FetchThirdPartyBoardsRequest,
	FetchThirdPartyBoardsResponse,
	GitLabBoard,
	GitLabCreateCardRequest,
	GitLabCreateCardResponse
} from "../protocol/agent.protocol";
import { CSGitLabProviderInfo } from "../protocol/api.protocol";
import { log, lspHandler, lspProvider } from "../system";
import { ThirdPartyProviderBase } from "./provider";

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
export class GitLabProvider extends ThirdPartyProviderBase<CSGitLabProviderInfo> {
	private _gitlabUserId: string | undefined;

	private _knownProjects = new Map<String, GitLabProject>();

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

	async onConnected() {
		this._gitlabUserId = await this.getMemberId();
		this._knownProjects = new Map<String, GitLabProject>();
	}

	@log()
	async getBoards(
		request: FetchThirdPartyBoardsRequest
	): Promise<FetchThirdPartyBoardsResponse> {
		const { git } = Container.instance();
		const gitRepos = await git.getRepositories();

		const openProjects = new Map<String, GitLabProject>();

		for (const gitRepo of gitRepos) {
			const remotes = await git.getRepoRemotes(gitRepo.path);
			for (const remote of remotes) {
				if (remote.domain === "gitlab.com" && !openProjects.has(remote.path)) {
					let gitlabProject = this._knownProjects.get(remote.path);

					if (!gitlabProject) {
						try {
							const response = await this.get<GitLabProject>(
								`/projects/${encodeURIComponent(remote.path)}`
							);
							gitlabProject = {
								...response.body,
								path: gitRepo.path
							};
							this._knownProjects.set(remote.path, gitlabProject);
							// boards.push(response.body);
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

	@log()
	async createCard(request: CreateThirdPartyCardRequest) {
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
			`/projects/${encodeURIComponent(data.repoName)}/issues?${qs.stringify(data)}`,
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
		const response = await this.get<GitLabUser[]>(`/projects/${request.boardId}/users`);
		return { users: response.body.map(u => ({ ...u, displayName: u.name })) };
	}
}
