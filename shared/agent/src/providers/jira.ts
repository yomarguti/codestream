"use strict";
import * as qs from "querystring";
import { Container } from "../container";
import { Logger } from "../logger";
import {
	CreateJiraCardRequest,
	CreateThirdPartyCardRequest,
	FetchThirdPartyBoardsRequest,
	FetchThirdPartyBoardsResponse,
	JiraBoard,
	JiraUser,
	ReportingMessageType
} from "../protocol/agent.protocol";
import { CSJiraProviderInfo } from "../protocol/api.protocol";
import { Iterables, log, lspProvider } from "../system";
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
	values: JiraProject[];
	nextPage?: string;
	isLast: boolean;
	total: number;
}

interface CreateJiraIssueResponse {
	id: string;
	key: string;
	self: string;
}

@lspProvider("jira")
export class JiraProvider extends ThirdPartyProviderBase<CSJiraProviderInfo> {
	private _urlAddon = "";
	private boards: JiraBoard[] = [];
	private domain?: string;

	get displayName() {
		return "Jira";
	}

	get name() {
		return "jira";
	}

	get baseUrl() {
		return `${super.baseUrl}${this._urlAddon}`;
	}

	get headers() {
		return {
			Authorization: `Bearer ${this.accessToken}`,
			Accept: "application/json",
			"Content-Type": "application/json"
		};
	}

	async onConnected() {
		this._urlAddon = "";
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

		this._urlAddon = `/ex/jira/${response.body[0].id}`;
		this.domain = response.body[0].name;

		Logger.debug(`Jira: api url for ${this.domain} is ${this._urlAddon}`);
	}

	async onDisconnected() {
		this.boards = [];
	}

	@log()
	async getBoards(
		request: FetchThirdPartyBoardsRequest
	): Promise<FetchThirdPartyBoardsResponse> {
		if (this.boards.length > 0) return { boards: this.boards };
		try {
			Logger.debug("Jira: fetching projects");
			const jiraBoards: JiraBoard[] = [];
			let nextPage: string | undefined = "/rest/api/2/project/search";

			while (nextPage !== undefined) {
				try {
					const { body }: { body: ProjectSearchResponse } = await this.get<ProjectSearchResponse>(
						nextPage
					);
					Logger.debug(`Jira: got ${body.values.length} projects`);

					jiraBoards.push(...(await this.filterBoards(body.values)));

					Logger.debug(`Jira: is last page? ${body.isLast} - nextPage ${body.nextPage}`);
					if (body.nextPage) {
						nextPage = body.nextPage.substring(body.nextPage.indexOf("/rest/api/2"));
					} else {
						Logger.debug("Jira: there are no more projects");
						nextPage = undefined;
					}
				} catch (e) {
					Container.instance().errorReporter.reportMessage({
						type: ReportingMessageType.Error,
						message: "Jira: Error fetching jira projects",
						source: "agent",
						extra: {
							message: e.message
						}
					});
					Logger.error(e);
					Logger.debug("Jira: Stopping project search");
					nextPage = undefined;
				}
			}

			Logger.debug(`Jira: total compatible projects: ${jiraBoards.length}`);

			this.boards = jiraBoards;

			return { boards: jiraBoards };
		} catch (error) {
			debugger;
			Container.instance().errorReporter.reportMessage({
				type: ReportingMessageType.Error,
				message: "Jira: Error fetching jira boards",
				source: "agent",
				extra: { message: error.message }
			});
			Logger.error(error, "Error fetching jira boards");
			return { boards: [] };
		}
	}

	private async filterBoards(projects: JiraProject[]): Promise<JiraBoard[]> {
		Logger.debug("Jira: Filtering for compatible projects");
		try {
			const response = await this.get<JiraProjectsMetaResponse>(
				`/rest/api/2/issue/createmeta?${qs.stringify({
					projectIds: projects.map(p => p.id).join(","),
					expand: "projects.issuetypes.fields"
				})}`
			);

			return this.getCompatibleBoards(response.body);
		} catch (error) {
			Container.instance().errorReporter.reportMessage({
				type: ReportingMessageType.Error,
				message: "Jira: Error fetching issue metadata for projects",
				source: "agent",
				extra: { message: error.message }
			});
			Logger.error(
				error,
				"Jira: Error fetching issue metadata for boards. Couldn't determine compatible projects"
			);
			return [];
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
	async createCard(request: CreateThirdPartyCardRequest) {
		const data = request.data as CreateJiraCardRequest;
		// using /api/2 because 3 returns nonsense errors for the same request
		const body: { [k: string]: any } = {
			fields: {
				project: {
					id: data.project
				},
				issuetype: {
					name: data.issueType
				},
				summary: data.summary,
				description: data.description
			}
		};

		if (data.assignees && data.assignees.length > 0) {
			body.fields.assignee = { name: data.assignees[0].name };
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
			`/rest/api/2/user/assignable/search?${qs.stringify({
				project: request.boardId
			})}`
		);
		return { users: body.map(u => ({ ...u, id: u.accountId, email: u.emailAddress })) };
	}
}
