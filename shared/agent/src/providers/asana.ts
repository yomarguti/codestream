"use strict";
import * as qs from "querystring";
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

interface AsanaWorkspace {
	id: number;
	gid: string;
}

interface AsanaProject {
	id: number;
	gid: string;
	layout: string;
	name: string;
	sections: AsanaSection[];
}

interface AsanaSection {
	id: number;
	gid: string;
	name: string;
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

	get headers() {
		return {
			Authorization: `Bearer ${this.accessToken}`
		};
	}

	async onConnected() {
		this._asanaUser = await this.getMe();
	}

	@log()
	@lspHandler(AsanaFetchBoardsRequestType)
	async boards(request: AsanaFetchBoardsRequest) {
		const projects = await this.getProjects();
		const boards: AsanaBoard[] = [];
		for (const project of projects) {
			const board: AsanaBoard = {
				id: project.id,
				name: project.name,
				lists: []
			};

			if (project.layout !== "board") {
				board.lists.push({
					id: undefined!,
					name: "No Section"
				});
			}

			for (const section of project.sections) {
				const list: AsanaList = {
					id: section.id,
					name: section.name
				};
				board.lists.push(list);
			}

			boards.push(board);
		}

		return { boards };
	}

	async getProjects(): Promise<AsanaProject[]> {
		let projects: AsanaProject[] = [];

		try {
			let apiResponse = await this.get<{ data: AsanaProject[]; next_page: any }>(
				`/api/1.0/projects?${qs.stringify({
					opt_fields: "layout,name,sections,sections.name",
					archived: false
				})}`
			);
			projects = apiResponse.body.data;

			let nextPage: string | undefined;
			while ((nextPage = this.nextPage(apiResponse.body))) {
				apiResponse = await this.get<{ data: AsanaProject[]; next_page: any }>(nextPage);
				projects = projects.concat(apiResponse.body.data);
			}
		} catch (err) {
			Logger.error(err);
			debugger;
		}

		return projects;
	}

	async getWorkspaceProjects(workspace: AsanaWorkspace): Promise<AsanaBoard[]> {
		let projects: AsanaBoard[] = [];

		try {
			let apiResponse = await this.get<{ data: AsanaBoard[]; next_page: any }>(
				`/api/1.0/workspaces/${workspace.gid}/projects?${qs.stringify({
					archived: false,
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
