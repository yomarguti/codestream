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
	GitHubList
} from "../shared/agent.protocol";
import { CSGitHubProviderInfo } from "../shared/api.protocol";
import { log, lspHandler, lspProvider } from "../system";
import { ThirdPartyProviderBase } from "./provider";

@lspProvider("github")
export class GitHubProvider extends ThirdPartyProviderBase<CSGitHubProviderInfo> {
	private _githubUserId: string | undefined;

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

	private get apiKey() {
		return this._providerInfo && this._providerInfo.apiKey;
	}

	private get token() {
		return this._providerInfo && this._providerInfo.accessToken;
	}

	async onConnected() {
		this._githubUserId = await this.getMemberId();
	}

	@log()
	@lspHandler(GitHubFetchBoardsRequestType)
	async boards(request: GitHubFetchBoardsRequest) {
		void (await this.ensureConnected());

		const { git } = Container.instance();
		const repos = await git.getRepositories();
		let boards: GitHubBoard[];

		try {
			let apiResponse = await this.get<GitHubBoard[]>(
				`/user/repos?${qs.stringify({ access_token: this.token })}`
			);
			boards = apiResponse.body;

			let nextPage: string | undefined;
			while ((nextPage = this.nextPage(apiResponse.response))) {
				apiResponse = await this.get<GitHubBoard[]>(nextPage);
				boards = boards.concat(apiResponse.body);
			}
		} catch (err) {
			boards = [];
			Logger.error(err);
			debugger;
		}

		for (const repo of repos) {
			const remotes = await git.getRepoRemotes(repo.path);
			for (const remote of remotes) {
				if (remote.domain === "github.com") {
					try {
						const response = await this.get<GitHubBoard>(
							`/repos/${remote.path}?${qs.stringify({ access_token: this.token })}`
						);
						boards.push(response.body);
					} catch (err) {
						Logger.error(err);
						debugger;
					}
				}
			}
		}

		return {
			boards
		};
	}

	@log()
	@lspHandler(GitHubCreateCardRequestType)
	async createCard(request: GitHubCreateCardRequest) {
		void (await this.ensureConnected());

		const response = await this.post<{}, GitHubCreateCardResponse>(
			`/repos/${request.repoName}/issues?${qs.stringify({
				access_token: this.token
				// idList: request.listId,
				// name: request.name,
				// desc: request.description,
				// key: this.apiKey,
				// token: this.token
			})}`,
			{
				title: request.title,
				body: request.description
				// milestone,
				// labels,
				// assignees
			}
		);
		return response;
	}

	@log()
	@lspHandler(GitHubFetchListsRequestType)
	async lists(request: GitHubFetchListsRequest) {
		void (await this.ensureConnected());

		const response = await this.get<GitHubList[]>(
			`/boards/${request.boardId}/lists?${qs.stringify({ key: this.apiKey, token: this.token })}`
		);
		return { lists: response.body.filter(l => !l.closed) };
	}

	private async getMemberId() {
		const userResponse = await this.get<{ id: string; [key: string]: any }>(
			`/user?${qs.stringify({ access_token: this.token })}`
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
}
