"use strict";
import * as qs from "querystring";
import { Container } from "../container";
import { Logger } from "../logger";
import {
	AsanaBoard,
	AsanaCreateCardRequest,
	AsanaCreateCardRequestType,
	AsanaCreateCardResponse,
	AsanaFetchBoardsRequest,
	AsanaFetchBoardsRequestType,
	AsanaFetchListsRequest,
	AsanaFetchListsRequestType,
	AsanaList
} from "../shared/agent.protocol";
import { CSAsanaProviderInfo } from "../shared/api.protocol";
import { log, lspHandler, lspProvider } from "../system";
import { ThirdPartyProviderBase } from "./provider";

interface AsanaRepo {
	id: number;
	full_name: string;
	path: string;
}

interface AsanaWorkspace {
	id: number;
	gid: string;
}

interface AsanaUser {
	id: number;
	gid: string;
	workspaces: AsanaWorkspace[];
}

@lspProvider("asana")
export class AsanaProvider extends ThirdPartyProviderBase<CSAsanaProviderInfo> {
	private _asanaUser: AsanaUser | undefined;

	get baseUrl() {
		return "https://app.asana.com";
	}

	get displayName() {
		return "Asana";
	}

	get name() {
		return "asana";
	}

	async headers() {
		return {
			Authorization: `Bearer ${await this.token()}`
		};
	}

	private async token() {
		if (!this._providerInfo) {
			return;
		}
		const expiration = this._providerInfo.expiresAt;
		const now = new Date().getTime();
		const oneMinute = 60 * 1000;
		if (now > expiration - oneMinute) {
			const me = await Container.instance().session.api.refreshThirdPartyProvider({
				providerName: "asana",
				refreshToken: this._providerInfo.refreshToken
			});
			this._providerInfo = this.getProviderInfo(me);
		}

		return this._providerInfo && this._providerInfo.accessToken;
	}

	async onConnected() {
		this._asanaUser = await this.getMe();
	}

	@log()
	@lspHandler(AsanaFetchBoardsRequestType)
	async boards(request: AsanaFetchBoardsRequest) {
		void (await this.ensureConnected());

		let boards: AsanaBoard[] = [];

		if (!this._asanaUser) {
			return { boards };
		}

		for (const workspace of this._asanaUser.workspaces) {
			boards = boards.concat(await this.getWorkspaceProjects(workspace));
		}

		for (const board of boards) {
			board.lists = await this.lists({ boardId: board.gid });
		}

		return { boards };
	}

	async getWorkspaceProjects(workspace: AsanaWorkspace): Promise<AsanaBoard[]> {
		let projects: AsanaBoard[] = [];

		try {
			let apiResponse = await this.get<{ data: AsanaBoard[]; next_page: any }>(
				`/api/1.0/workspaces/${workspace.gid}/projects?${qs.stringify({
					limit: 100
				})}`
			);
			projects = apiResponse.body.data;

			let nextPage: string | undefined;
			while ((nextPage = this.nextPage(apiResponse.body))) {
				apiResponse = await this.get<{ data: AsanaBoard[]; next_page: any }>(nextPage);
				projects = projects.concat(apiResponse.body.data);
			}
		} catch (err) {
			Logger.error(err);
			debugger;
		}

		return projects;
	}

	@log()
	@lspHandler(AsanaCreateCardRequestType)
	async createCard(request: AsanaCreateCardRequest) {
		void (await this.ensureConnected());

		return await this.post<{}, AsanaCreateCardResponse>(`/api/1.0/tasks`, {
			data: {
				name: request.name,
				notes: request.description,
				projects: [request.boardId],
				memberships: [
					{
						project: request.boardId,
						section: request.listId
					}
				]
			}
		});
	}

	@log()
	@lspHandler(AsanaFetchListsRequestType)
	async lists(request: AsanaFetchListsRequest) {
		void (await this.ensureConnected());

		try {
			const response = await this.get<{ data: AsanaList[] }>(
				`/api/1.0/projects/${request.boardId}/sections?${qs.stringify({ limit: 100 })}`
			);

			return response.body.data;
		} catch (err) {
			debugger;
			Logger.log(err);
			return [];
		}
		// return { lists: response.body.filter(l => !l.closed) };
	}

	private async getMe(): Promise<AsanaUser> {
		const userResponse = await this.get<{ data: AsanaUser }>(`/api/1.0/users/me`);
		return userResponse.body.data;
	}

	private nextPage(responseBody: { next_page: any }): string | undefined {
		if (!responseBody.next_page) {
			return;
		}

		return "/api/1.0" + responseBody.next_page.path;
	}
}
