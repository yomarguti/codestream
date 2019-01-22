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
	AsanaList,
	AsanaProject,
	AsanaUser,
	AsanaWorkspace
} from "../shared/agent.protocol";
import { CSAsanaProviderInfo } from "../shared/api.protocol";
import { log, lspHandler, lspProvider } from "../system";
import { ThirdPartyProviderBase } from "./provider";

interface AsanaProjectData {
	data: AsanaProject;
}

interface AsanaUsersData {
	data: AsanaUser[];
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
				lists: [],
				singleAssignee: true	// asana cards allow only a single assignee
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
		const data = {
			data: {
				name: request.name,
				notes: request.description,
				projects: [request.boardId],
				memberships: [
					{
						project: request.boardId,
						section: request.listId
					}
				],
				assignee: request.assignee || undefined
			}
		};
		const response = await this.post<{}, AsanaCreateCardResponse>(`/api/1.0/tasks`, data);
		const card = response.body.data;
		card.url = `${this.baseUrl}/0/${card.projects[0].gid}/${card.gid}`;
		return card;
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

	@log()
	async getAssignableUsers(request: { boardId: string }) {
		const response = await this.get<AsanaProjectData>(
			`/api/1.0/projects/${request.boardId}`
		);
		const workspaceId = response.body.data.workspace.gid;

		const { body } = await this.get<AsanaUsersData>(
			`/api/1.0/workspaces/${workspaceId}/users?${qs.stringify({ opt_fields: "name,email" })}`
		);
		return { users: body.data.map(u => ({ ...u, displayName: u.name, id: u.gid })) };
	}
}
