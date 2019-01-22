"use strict";
import { Response } from "node-fetch";
import * as qs from "querystring";
import { Container } from "../container";
import { Logger } from "../logger";
import {
	GitHubBoard,
	GitHubCreateCardRequest,
	GitHubCreateCardRequestType,
	GitHubCreateCardResponse,
	GitHubFetchBoardsRequest,
	GitHubFetchBoardsRequestType,
	GitHubFetchListsRequest,
	GitHubFetchListsRequestType,
	GitHubList,
	GitHubUser
} from "../shared/agent.protocol";
import { CSGitHubProviderInfo } from "../shared/api.protocol";
import { log, lspHandler, lspProvider } from "../system";
import { ThirdPartyProviderBase } from "./provider";

interface GitHubRepo {
	id: string;
	full_name: string;
	path: string;
}

@lspProvider("github")
export class GitHubProvider extends ThirdPartyProviderBase<CSGitHubProviderInfo> {
	private _githubUserId: string | undefined;

	private _knownRepos = new Map<String, GitHubRepo>();

	get baseUrl() {
		return "https://api.github.com";
	}

	get displayName() {
		return "GitHub";
	}

	get name() {
		return "github";
	}

	get headers() {
		return {
			"user-agent": "CodeStream",
			Accept: "application/vnd.github.v3+json, application/vnd.github.inertia-preview+json"
		};
	}

	async onConnected() {
		this._githubUserId = await this.getMemberId();
		this._knownRepos = new Map<String, GitHubRepo>();
	}

	@log()
	@lspHandler(GitHubFetchBoardsRequestType)
	async boards(request: GitHubFetchBoardsRequest) {
		const { git } = Container.instance();
		const gitRepos = await git.getRepositories();

		const openRepos = new Map<String, GitHubRepo>();

		for (const gitRepo of gitRepos) {
			const remotes = await git.getRepoRemotes(gitRepo.path);
			for (const remote of remotes) {
				if (remote.domain === "github.com" && !openRepos.has(remote.path)) {
					let githubRepo = this._knownRepos.get(remote.path);

					if (!githubRepo) {
						try {
							const response = await this.get<GitHubRepo>(
								`/repos/${remote.path}?${qs.stringify({ access_token: this.accessToken })}`
							);
							githubRepo = {
								...response.body,
								path: gitRepo.path
							};
							this._knownRepos.set(remote.path, githubRepo);
						} catch (err) {
							Logger.error(err);
							debugger;
						}
					}

					if (githubRepo) {
						openRepos.set(remote.path, githubRepo);
					}
				}
			}
		}

		let boards: GitHubBoard[];
		if (openRepos.size > 0) {
			boards = Array.from(openRepos.values()).map(r => ({
				id: r.id,
				name: r.full_name,
				apiIdentifier: r.full_name,
				path: r.path
			}));
		} else {
			let gitHubBoards: { [key: string]: string }[] = [];
			try {
				let apiResponse = await this.get<{ [key: string]: string }[]>(
					`/user/repos?${qs.stringify({ access_token: this.accessToken })}`
				);
				gitHubBoards = apiResponse.body;

				let nextPage: string | undefined;
				while ((nextPage = this.nextPage(apiResponse.response))) {
					apiResponse = await this.get<{ [key: string]: string }[]>(nextPage);
					gitHubBoards = gitHubBoards.concat(apiResponse.body);
				}
			} catch (err) {
				boards = [];
				Logger.error(err);
				debugger;
			}
			boards = gitHubBoards.map(board => {
				return {
					...board,
					id: board.id,
					name: board.full_name,
					apiIdentifier: board.full_name
				};
			});
		}

		return {
			boards
		};
	}

	@log()
	@lspHandler(GitHubCreateCardRequestType)
	async createCard(request: GitHubCreateCardRequest) {
		const response = await this.post<{}, GitHubCreateCardResponse>(
			`/repos/${request.repoName}/issues?${qs.stringify({
				access_token: this.accessToken
			})}`,
			{
				title: request.title,
				body: request.description,
				assignees: (request.assignees! || []).map(a => a.login)
			}
		);
		return response.body;
	}

	@log()
	@lspHandler(GitHubFetchListsRequestType)
	async lists(request: GitHubFetchListsRequest) {}

	private async getMemberId() {
		const userResponse = await this.get<{ id: string; [key: string]: any }>(
			`/user?${qs.stringify({ access_token: this.accessToken })}`
		);

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
		const { body } = await this.get<GitHubUser[]>(
			`/repos/${request.boardId}/collaborators?${qs.stringify({ access_token: this.accessToken })}`
		);
		return { users: body.map(u => ({ ...u, id: u.id, displayName: u.login })) };
	}
}
