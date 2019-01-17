"use strict";
import * as qs from "querystring";
import { Logger } from "../logger";
import {
	CreateJiraCardRequest,
	CreateJiraCardRequestType,
	JiraBoard,
	JiraFetchBoardsRequestType,
	JiraFetchBoardsResponse,
	JiraUser
} from "../shared/agent.protocol";
import { CSJiraProviderInfo } from "../shared/api.protocol";
import { Iterables, log, lspHandler, lspProvider } from "../system";
import { ThirdPartyProviderBase } from "./provider";

type AccessibleResourcesResponse = { id: string; name: string }[];
interface JiraProject {
	id: string;
	name: string;
}

interface IssueTypeDescriptor {
	name: string;
	fields: { [name: string]: { required: boolean; hasDefaultValue: boolean } };
}

interface JiraProjectMeta extends JiraProject {
	issuetypes: IssueTypeDescriptor[];
}

interface JiraProjectsMetaResponse {
	projects: JiraProjectMeta[];
}

@lspProvider("jira")
export class JiraProvider extends ThirdPartyProviderBase<CSJiraProviderInfo> {
	private jiraApiUrl = "https://api.atlassian.com";
	private _baseUrl = this.jiraApiUrl;
	private boards: JiraBoard[] = [];

	get baseUrl() {
		return this._baseUrl;
	}

	get displayName() {
		return "Jira";
	}

	get name() {
		return "jira";
	}

	get headers() {
		return {
			Authorization: `Bearer ${this.accessToken}`,
			Accept: "application/json",
			"Content-Type": "application/json"
		};
	}

	async onConnected() {
		const response = await this.get<AccessibleResourcesResponse>(
			"/oauth/token/accessible-resources"
		);
		this._baseUrl = `${this.jiraApiUrl}/ex/jira/${response.body[0].id}`;
		// debugger
	}

	async onDisconnected() {
		this._baseUrl = this.jiraApiUrl;
		this.boards = [];
	}

	@log()
	@lspHandler(JiraFetchBoardsRequestType)
	async getBoards(): Promise<JiraFetchBoardsResponse> {
		try {
			const { body } = await this.get<{ values: any[] }>("/rest/api/3/project/search");

			const response = await this.get<JiraProjectsMetaResponse>(
				`/rest/api/3/issue/createmeta?${qs.stringify({
					projectIds: body.values.map(v => v.id).join(","),
					expand: "projects.issuetypes.fields"
				})}`
			);

			this.boards = this.getCompatibleBoards(response.body);

			return { boards: this.boards };
		} catch (error) {
			debugger;
			Logger.error(error, "Error fetching jira boards");
			return { boards: [] };
		}
	}

	private getCompatibleBoards(meta: JiraProjectsMetaResponse) {
		return meta.projects.map(project => {
			const board: Partial<JiraBoard> = { id: project.id, name: project.name };

			const issueTypes = Array.from(
				Iterables.filterMap(project.issuetypes, type => {
					if (type.fields.summary && type.fields.description) {
						const hasOtherRequiredFields = Object.entries(type.fields).find(
							([name, attributes]) =>
								name !== "summary" &&
								name !== "description" &&
								name !== "issuetype" &&
								name !== "project" &&
								attributes.required &&
								!attributes.hasDefaultValue
						);

						if (type.fields.assignee === undefined) {
							board.assigneesDisabled = true;
						} else {
							board.assigneesRequired = type.fields.assignee.required;
						}
						return hasOtherRequiredFields ? undefined : type.name;
					}
					return undefined;
				})
			);

			board.issueTypes = issueTypes;
			return board as JiraBoard;
		});
	}

	@log()
	@lspHandler(CreateJiraCardRequestType)
	async createCard(request: CreateJiraCardRequest) {
		// using /api/2 because 3 returns nonsense errors for the same request
		const body: { [k: string]: any } = {
			fields: {
				project: {
					id: request.project
				},
				issuetype: {
					name: request.issueType
				},
				summary: request.summary,
				description: request.description
			}
		};

		if (request.assignees) {
			body.fields.assignee = { name: request.assignees[0].name };
		}
		const response = await this.post("/rest/api/2/issue", body);

		return response.body;
	}

	@log()
	async getAssignableUsers(request: { boardId: string }) {
		const { body } = await this.get<JiraUser[]>(
			`/rest/api/3/user/assignable/search?${qs.stringify({
				project: request.boardId
			})}`
		);
		return { users: body.map(u => ({ ...u, id: u.accountId })) };
	}
}
