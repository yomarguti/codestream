"use strict";
import { Response } from "node-fetch";
import * as qs from "querystring";
import { Container } from "../container";
import { Logger } from "../logger";
import {
	GitLabBoard,
	GitLabCreateCardRequest,
	GitLabCreateCardRequestType,
	GitLabCreateCardResponse,
	GitLabFetchBoardsRequest,
	GitLabFetchBoardsRequestType,
	GitLabFetchListsRequest,
	GitLabFetchListsRequestType,
	GitLabList
} from "../shared/agent.protocol";
import { CSGitLabProviderInfo } from "../shared/api.protocol";
import { log, lspHandler, lspProvider } from "../system";
import { ThirdPartyProviderBase } from "./provider";

interface GitLabProject {
	path_with_namespace: any;
	id: string;
	path: string;
}

interface GitLabUser {
	id: string;
	name: string;
}

@lspProvider("gitlab")
export class GitLabProvider extends ThirdPartyProviderBase<CSGitLabProviderInfo> {
	private _gitlabUserId: string | undefined;

	private _knownProjects = new Map<String, GitLabProject>();

	get baseUrl() {
		return "https://gitlab.com/api/v4/";
	}

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
	@lspHandler(GitLabFetchBoardsRequestType)
	async boards(request: GitLabFetchBoardsRequest) {
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
			boards = Array.from(openProjects.values()).map(p => ({
				id: p.id,
				name: p.path_with_namespace,
				path: p.path,
				singleAssignee: true // gitlab only allows a single assignee per issue (at least it only shows one in the UI)
			}));
		} else {
			let gitLabProjects: { [key: string]: string }[] = [];
			try {
				let apiResponse = await this.get<{ [key: string]: string }[]>(
					`/projects?min_access_level=20`
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
	@lspHandler(GitLabCreateCardRequestType)
	async createCard(request: GitLabCreateCardRequest) {
		const data: { [key: string]: any } = {
			title: request.title,
			description: request.description
		};
		if (request.assignee) {
			// GitLab allows for multiple assignees in the API, but only one appears in the UI
			data.assignee_ids = [request.assignee.id];
		}
		const response = await this.post<{}, GitLabCreateCardResponse>(
			`/projects/${encodeURIComponent(request.repoName)}/issues?${qs.stringify(data)}`,
			{}
		);
		return { ...response.body, url: response.body.web_url };
	}

	@log()
	@lspHandler(GitLabFetchListsRequestType)
	async lists(request: GitLabFetchListsRequest) {}

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
				return url.substring(1, url.length - 1).replace(this.baseUrl, "");
			}
		}
		return undefined;
	}

	@log()
	async getAssignableUsers(request: { boardId: string }) {
		const response = await this.get<GitLabUser[]>(
			`/projects/${request.boardId}/users`
		);
		return { users: response.body.map(u => ({ ...u, displayName: u.name })) };
	}

}
