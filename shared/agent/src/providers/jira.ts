"use strict";
import * as qs from "querystring";
import { Container } from "../container";
import { Logger } from "../logger";
import {
	CreateJiraCardRequest,
	CreateJiraCardRequestType,
	JiraBoard,
	JiraFetchBoardsRequestType,
	JiraFetchBoardsResponse,
	JiraUser,
	ReportingMessageType
} from "../protocol/agent.protocol";
import { CSJiraProviderInfo } from "../protocol/api.protocol";
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
interface ProjectSearchResponse {
	values: any[];
	nextPage?: string;
	isLast: boolean;
}

interface CreateJiraIssueResponse {
	id: string;
	key: string;
	self: string;
}

@lspProvider("jira")
export class JiraProvider extends ThirdPartyProviderBase<CSJiraProviderInfo> {
	private readonly jiraApiUrl = "https://api.atlassian.com";
	private _baseUrl = this.jiraApiUrl;
	private boards: JiraBoard[] = [];
	private domain?: string;

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

		Logger.debug("Jira: Accessible Resources are", response.body);

		if (response.body.length === 0) {
			Container.instance().errorReporter.reportMessage({
				type: ReportingMessageType.Error,
				message: "Jira access does not include any jira sites",
				source: "agent"
			});
			throw new Error("Jira access does not include any jira sites");
		}

		this._baseUrl = `${this.jiraApiUrl}/ex/jira/${response.body[0].id}`;
		this.domain = response.body[0].name;

		Logger.debug(`Jira: api url for ${this.domain} is ${this._baseUrl}`);
	}

	async onDisconnected() {
		this._baseUrl = this.jiraApiUrl;
		this.boards = [];
	}

	@log()
	@lspHandler(JiraFetchBoardsRequestType)
	async getBoards(): Promise<JiraFetchBoardsResponse> {
		if (this.boards.length > 0) return { boards: this.boards };
		try {
			const projectIds = [];
			let hasMore = true;
			let { body } = await this.get<ProjectSearchResponse>("/rest/api/3/project/search");

			while (hasMore) {
				projectIds.push(...body.values.map(v => v.id));
				if (!body.isLast && body.nextPage) {
					body = (await this.get<ProjectSearchResponse>(body.nextPage)).body;
				} else {
					hasMore = false;
				}
			}

			const response = await this.get<JiraProjectsMetaResponse>(
				`/rest/api/3/issue/createmeta?${qs.stringify({
					projectIds: projectIds.join(","),
					expand: "projects.issuetypes.fields"
				})}`
			);

			this.boards = this.getCompatibleBoards(response.body);

			return { boards: this.boards };
		} catch (error) {
			debugger;
			Container.instance().errorReporter.reportMessage({
				type: ReportingMessageType.Error,
				message: "Error fetching jira boards",
				source: "extension",
				extra: { message: error.message }
			});
			Logger.error(error, "Error fetching jira boards");
			return { boards: [] };
		}
	}

	private getCompatibleBoards(meta: JiraProjectsMetaResponse) {
		const boards = meta.projects.map(project => {
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
			board.singleAssignee = true; // all jira cards have a single assignee?
			return board as JiraBoard;
		});
		return boards;
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

		if (request.assignees && request.assignees.length > 0) {
			body.fields.assignee = { name: request.assignees[0].name };
		}
		const response = await this.post<typeof body, CreateJiraIssueResponse>(
			"/rest/api/2/issue",
			body
		);
		return {
			id: response.body.id,
			url: `https://${this.domain!}.atlassian.net/browse/${response.body.key}`
		};
	}

	@log()
	async getAssignableUsers(request: { boardId: string }) {
		const { body } = await this.get<JiraUser[]>(
			`/rest/api/3/user/assignable/search?${qs.stringify({
				project: request.boardId
			})}`
		);
		return { users: body.map(u => ({ ...u, id: u.accountId, email: u.emailAddress })) };
	}
}
