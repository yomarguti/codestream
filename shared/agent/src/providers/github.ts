"use strict";
import { Response } from "node-fetch";
import { Container } from "../container";
import { Logger } from "../logger";
import {
	CreateThirdPartyCardRequest,
	FetchThirdPartyBoardsRequest,
	FetchThirdPartyBoardsResponse,
	GitHubBoard,
	GitHubCreateCardRequest,
	GitHubCreateCardResponse,
	GitHubUser
} from "../protocol/agent.protocol";
import { CSGitHubProviderInfo } from "../protocol/api.protocol";
import { log, lspHandler, lspProvider } from "../system";
import { ThirdPartyProviderBase } from "./provider";

interface GitHubRepo {
	id: string;
	full_name: string;
	path: string;
	has_issues: boolean;
}

@lspProvider("github")
export class GitHubProvider extends ThirdPartyProviderBase<CSGitHubProviderInfo> {
	private _githubUserId: string | undefined;

	private _knownRepos = new Map<String, GitHubRepo>();

	get displayName() {
		return "GitHub";
	}

	get name() {
		return "github";
	}

	get apiPath() {
		return this.providerInstance.isEnterprise ? "/api/v3" : "";
	}

	get headers() {
		return {
			Authorization: `token ${this.accessToken}`,
			"user-agent": "CodeStream",
			Accept: "application/vnd.github.v3+json, application/vnd.github.inertia-preview+json"
		};
	}

	async onConnected() {
		this._githubUserId = await this.getMemberId();
		this._knownRepos = new Map<String, GitHubRepo>();
	}

	@log()
	async getBoards(
		request: FetchThirdPartyBoardsRequest
	): Promise<FetchThirdPartyBoardsResponse> {
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
							const response = await this.get<GitHubRepo>(`/repos/${remote.path}`);
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
		const { body } = await this.get<GitHubUser[]>(`/repos/${request.boardId}/collaborators`);
		return { users: body.map(u => ({ ...u, id: u.id, displayName: u.login })) };
	}
}
