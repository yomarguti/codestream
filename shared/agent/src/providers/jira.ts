"use strict";
import * as qs from "querystring";
import { Logger } from "../logger";
import { JiraFetchBoardsRequestType, JiraFetchBoardsResponse } from "../shared/agent.protocol";
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

	private get accessToken() {
		return this._providerInfo && this._providerInfo.accessToken;
	}

	async onConnected() {
		const response = await this.fetch<AccessibleResourcesResponse>(
			"/oauth/token/accessible-resources",
			{
				headers: { Authorization: `Bearer ${this.accessToken}`, Accept: "application/json" }
			}
		);
		this._baseUrl = `${this.jiraApiUrl}/ex/jira/${response[0].id}`;
	}

	@log()
	@lspHandler(JiraFetchBoardsRequestType)
	async boards(): Promise<JiraFetchBoardsResponse> {
		await this.ensureConnected();
		try {
			const { values } = await this.fetch<{ values: any[] }>("/rest/api/3/project/search", {
				headers: { Authorization: `Bearer ${this.accessToken}`, Accept: "application/json" }
			});

			const response = await this.fetch<JiraProjectsMetaResponse>(
				`/rest/api/3/issue/createmeta?${qs.stringify({
					projectIds: values.map(v => v.id).join(","),
					expand: "projects.issuetypes.fields"
				})}`,
				{
					headers: { Authorization: `Bearer ${this.accessToken}`, Accept: "application/json" }
				}
			);

			return {
				boards: response.projects.map(project => ({
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
}
