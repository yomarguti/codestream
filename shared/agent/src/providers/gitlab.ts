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

interface GitLabRepo {
	path_with_namespace: any;
	id: string;
	path: string;
}

@lspProvider("gitlab")
export class GitLabProvider extends ThirdPartyProviderBase<CSGitLabProviderInfo> {
	private _gitlabUserId: string | undefined;

	private _knownRepos = new Map<String, GitLabRepo>();

	get baseUrl() {
		return "https://gitlab.com/api/v4/";
	}

	get displayName() {
		return "GitLab";
	}

	get name() {
		return "gitlab";
	}

	async headers() {
		return {
			Authorization: `Bearer ${this.token}`
		};
	}

	private get apiKey() {
		return this._providerInfo && this._providerInfo.apiKey;
	}

	private get token() {
		return this._providerInfo && this._providerInfo.accessToken;
	}

	async onConnected() {
		this._gitlabUserId = await this.getMemberId();
		this._knownRepos = new Map<String, GitLabRepo>();
	}

	@log()
	@lspHandler(GitLabFetchBoardsRequestType)
	async boards(request: GitLabFetchBoardsRequest) {
		void (await this.ensureConnected());

		const { git } = Container.instance();
		const gitRepos = await git.getRepositories();
		// let boards: GitLabBoard[];

		// try {
		// 	let apiResponse = await this.get<GitLabBoard[]>(
		// 		`/user/repos?${qs.stringify({ access_token: this.token })}`
		// 	);
		// 	boards = apiResponse.body;
		//
		// 	let nextPage: string | undefined;
		// 	while ((nextPage = this.nextPage(apiResponse.response))) {
		// 		apiResponse = await this.get<GitLabBoard[]>(nextPage);
		// 		boards = boards.concat(apiResponse.body);
		// 	}
		// } catch (err) {
		// 	boards = [];
		// 	Logger.error(err);
		// 	debugger;
		// }

		const openRepos = new Map<String, GitLabRepo>();

		for (const gitRepo of gitRepos) {
			const remotes = await git.getRepoRemotes(gitRepo.path);
			for (const remote of remotes) {
				if (remote.domain === "gitlab.com" && !openRepos.has(remote.path)) {
					let gitlabRepo = this._knownRepos.get(remote.path);

					if (!gitlabRepo) {
						try {
							const response = await this.get<GitLabRepo>(
								`/projects/${encodeURIComponent(remote.path)}`
							);
							gitlabRepo = {
								...response.body,
								path: gitRepo.path
							};
							this._knownRepos.set(remote.path, gitlabRepo);
							// boards.push(response.body);
						} catch (err) {
							Logger.error(err);
							debugger;
						}
					}

					if (gitlabRepo) {
						openRepos.set(remote.path, gitlabRepo);
					}
				}
			}
		}

		const boards = Array.from(openRepos.values()).map(r => ({
			id: r.id,
			name: r.path_with_namespace,
			path: r.path
		}));

		return {
			boards
		};
	}

	@log()
	@lspHandler(GitLabCreateCardRequestType)
	async createCard(request: GitLabCreateCardRequest) {
		void (await this.ensureConnected());

		const response = await this.post<{}, GitLabCreateCardResponse>(
			`/projects/${encodeURIComponent(request.repoName)}/issues?${qs.stringify({
				title: request.title,
				description: request.description
			})}`,
			{}
		);
		return response;
	}

	@log()
	@lspHandler(GitLabFetchListsRequestType)
	async lists(request: GitLabFetchListsRequest) {
		void (await this.ensureConnected());

		const response = await this.get<GitLabList[]>(
			`/boards/${request.boardId}/lists?${qs.stringify({ key: this.apiKey, token: this.token })}`
		);
		return { lists: response.body.filter(l => !l.closed) };
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
				return url.substring(1, url.length - 1).replace(this.baseUrl, "");
			}
		}
		return undefined;
	}
}
