"use strict";
import * as qs from "querystring";
import { Logger } from "../logger";
import {
	CreateJiraCardRequest,
	CreateJiraCardRequestType,
	JiraFetchBoardsRequestType,
	JiraFetchBoardsResponse
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

	private get accessToken() {
		return this._providerInfo && this._providerInfo.accessToken;
	}

	async onConnected() {
		const response = await this.get<AccessibleResourcesResponse>(
			"/oauth/token/accessible-resources"
		);
		this._baseUrl = `${this.jiraApiUrl}/ex/jira/${response.body[0].id}`;
	}

	@log()
	@lspHandler(JiraFetchBoardsRequestType)
	async boards(): Promise<JiraFetchBoardsResponse> {
		await this.ensureConnected();
		try {
			const { body } = await this.get<{ values: any[] }>("/rest/api/3/project/search");

			const response = await this.get<JiraProjectsMetaResponse>(
				`/rest/api/3/issue/createmeta?${qs.stringify({
					projectIds: body.values.map(v => v.id).join(","),
					expand: "projects.issuetypes.fields"
				})}`
			);

			return {
				boards: response.body.projects.map(project => ({
					id: project.id,
					name: project.name,
					issueTypes: Array.from(
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
								return hasOtherRequiredFields ? undefined : type.name;
							}
							return undefined;
						})
					)
				}))
			};
		} catch (error) {
			debugger;
			Logger.error(error, "Error fetching jira boards");
			return { boards: [] };
		}
	}

	@log()
	@lspHandler(CreateJiraCardRequestType)
	async createCard(request: CreateJiraCardRequest) {
		await this.ensureConnected();
		// using /api/2 because 3 returns nonsense errors for the same request
		const response = await this.post("/rest/api/2/issue", {
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
		});
		return response.body;
	}

	async ensureConnected() {
		if (this._providerInfo) {
			// If token expires just disconnect
			// TODO: refresh token
			if (this._providerInfo.expiresAt <= new Date().getTime()) {
				await this.disconnect();
				return super.ensureConnected();
			}
		} else return super.ensureConnected();
	}
}
