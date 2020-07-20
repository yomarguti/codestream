"use strict";
import { OAuth } from "oauth";
import * as qs from "querystring";
import { Container } from "../container";
import { Logger } from "../logger";
import {
	CreateJiraCardRequest,
	CreateThirdPartyCardRequest,
	FetchThirdPartyBoardsRequest,
	FetchThirdPartyBoardsResponse,
	FetchThirdPartyCardsRequest,
	FetchThirdPartyCardsResponse,
	FetchThirdPartyCardWorkflowRequest,
	FetchThirdPartyCardWorkflowResponse,
	JiraBoard,
	JiraCard,
	JiraUser,
	MoveThirdPartyCardRequest,
	ReportingMessageType,
	ThirdPartyProviderCard,
	ThirdPartyProviderConfig
} from "../protocol/agent.protocol";
import { CSJiraServerProviderInfo } from "../protocol/api.protocol";
import { CodeStreamSession } from "../session";
import { Iterables, log, lspProvider } from "../system";
import { ThirdPartyIssueProviderBase } from "./provider";
import { makeCardFromJira } from "./jira";

export type jsonCallback = (
	err?: { statusCode: number; data?: any },
	result?: { [key: string]: any }
) => any;

// HACK: the oauth node module library doesn't allow us to specify Content-Type
// when calling the get() function to fetch a resource (stuuuuuupid...) ... so
// create an extension of the class, calling an internal function (BAD) to do
// the dirty work
class OAuthExtended extends OAuth {
	fetchJson(
		method: string,
		url: string,
		body: { [key: string]: any } | undefined,
		oauthToken: string,
		oauthTokenSecret: string,
		callback: jsonCallback
	) {
		this._performSecureRequest(
			oauthToken,
			oauthTokenSecret,
			method,
			url,
			undefined,
			body ? JSON.stringify(body) : undefined,
			"application/json",
			(error, result) => {
				if (error) {
					return callback(error);
				}
				let json;
				try {
					json = JSON.parse(result as string);
				} catch (error) {
					return callback({ statusCode: 500, data: "unable to parse returned data: " + error });
				}
				return callback(undefined, json);
			}
		);
	}
}

interface JiraServerOauthParams {
	consumerKey: string;
	privateKey: string;
}

interface JiraProject {
	id: string;
	name: string;
	key: string;
}

interface IssueTypeDescriptor {
	name: string;
	iconUrl: string;
	fields: { [name: string]: { required: boolean; hasDefaultValue: boolean } };
}

interface JiraProjectMeta extends JiraProject {
	issuetypes: IssueTypeDescriptor[];
}

interface JiraProjectsMetaResponse {
	projects: JiraProjectMeta[];
}

interface CreateJiraIssueResponse {
	id: string;
	key: string;
	self: string;
}

interface CardSearchResponse {
	issues: JiraCard[];
	nextPage?: string;
	isLast: boolean;
	total: number;
}

@lspProvider("jiraserver")
export class JiraServerProvider extends ThirdPartyIssueProviderBase<CSJiraServerProviderInfo> {
	private boards: JiraBoard[] = [];
	private oauth: OAuthExtended | undefined;

	constructor(
		public readonly session: CodeStreamSession,
		protected readonly providerConfig: ThirdPartyProviderConfig
	) {
		super(session, providerConfig);
		if (providerConfig.isEnterprise && providerConfig.oauthData) {
			const jiraServerConfig = providerConfig.oauthData! as JiraServerOauthParams;
			this.oauth = new OAuthExtended(
				"",
				"",
				jiraServerConfig.consumerKey,
				jiraServerConfig.privateKey,
				"1.0",
				null,
				"RSA-SHA1"
			);
		}
	}

	get displayName() {
		return "Jira Server";
	}

	get name() {
		return "jiraserver";
	}

	get headers() {
		return {};
	}

	async onConnected() {}

	async onDisconnected() {
		this.boards = [];
	}

	@log()
	async _callWithOauth(
		path: string,
		method: string = "GET",
		body: { [key: string]: any } | undefined = undefined
	) {
		await this.ensureConnected();
		return new Promise<any>((resolve, reject) => {
			const url = `${this.baseUrl}${path}`;
			this.oauth!.fetchJson(
				method,
				url,
				body,
				this._providerInfo!.accessToken,
				this._providerInfo!.oauthTokenSecret,
				(error, result) => {
					if (error) reject(error);
					else resolve(result);
				}
			);
		});
	}

	@log()
	async getBoards(request: FetchThirdPartyBoardsRequest): Promise<FetchThirdPartyBoardsResponse> {
		if (this.boards.length > 0) return { boards: this.boards };
		try {
			this.boards = [];
			const response: JiraProject[] = await this._callWithOauth("/rest/api/2/project");
			this.boards.push(...(await this.filterBoards(response)));
			return { boards: this.boards };
		} catch (error) {
			debugger;
			Container.instance().errorReporter.reportMessage({
				type: ReportingMessageType.Error,
				message: "Jira Server: Error fetching jira boards",
				source: "agent",
				extra: { message: error.message }
			});
			Logger.error(error, "Error fetching jira boards");
			return { boards: [] };
		}
	}

	private async filterBoards(projects: JiraProject[]): Promise<JiraBoard[]> {
		Logger.debug("Jira Server: Filtering for compatible projects");
		try {
			const response = await this._callWithOauth(
				`/rest/api/2/issue/createmeta?${qs.stringify({
					projectIds: projects.map(p => p.id).join(","),
					expand: "projects.issuetypes.fields"
				})}`
			);
			return this.getCompatibleBoards(response);
		} catch (error) {
			Container.instance().errorReporter.reportMessage({
				type: ReportingMessageType.Error,
				message: "Jira Server: Error fetching issue metadata for projects",
				source: "agent",
				extra: { message: error.message }
			});
			Logger.error(
				error,
				"Jira Server: Error fetching issue metadata for boards. Couldn't determine compatible projects"
			);
			return [];
		}
	}

	private getCompatibleBoards(meta: JiraProjectsMetaResponse) {
		const boards = meta.projects.map(project => {
			const board: Partial<JiraBoard> = { id: project.id, name: project.name, key: project.key };

			const issueTypes = Array.from(
				Iterables.filterMap(project.issuetypes, type => {
					if (type.fields.summary && type.fields.description) {
						const hasOtherRequiredFields = Object.entries(type.fields).find(
							([name, attributes]) =>
								name !== "summary" &&
								name !== "description" &&
								name !== "issuetype" &&
								name !== "project" &&
								name !== "reporter" &&
								attributes.required &&
								!attributes.hasDefaultValue
						);

						board.issueTypeIcons[type.name] = type.iconUrl;

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

	// https://community.atlassian.com/t5/Jira-Questions/How-to-get-all-Jira-statuses-from-a-workflow-of-an-issue-by/qaq-p/461172
	@log()
	async getCardWorkflow(
		request: FetchThirdPartyCardWorkflowRequest
	): Promise<FetchThirdPartyCardWorkflowResponse> {
		Logger.debug("Jira Server: fetching workflow for card: " + request.cardId);
		try {
			const response = await this._callWithOauth(`/rest/api/2/issue/${request.cardId}/transitions`);
			Logger.debug("GOT RESPONSE: ", JSON.stringify(response, null, 4));
			return { workflow: response.transitions };
		} catch (error) {
			Container.instance().errorReporter.reportMessage({
				type: ReportingMessageType.Error,
				message: "Jira Server: Error fetching issue workflow for projects",
				source: "agent",
				extra: { message: error.message }
			});
			Logger.error(error, "Jira Server: Error fetching card workflow");
			return { workflow: [] };
		}
	}

	@log()
	async getCards(request: FetchThirdPartyCardsRequest): Promise<FetchThirdPartyCardsResponse> {
		// /rest/api/2/search?jql=assignee=currentuser()
		// https://developer.atlassian.com/server/jira/platform/jira-rest-api-examples/

		try {
			Logger.debug("Jira: fetching cards");
			const jiraCards: JiraCard[] = [];
			let nextPage: string | undefined = `/rest/api/2/search?${qs.stringify({
				jql: request.customFilter || "assignee=currentuser() AND status!=Closed",
				expand: "transitions,names",
				fields: "summary,description,updated,subtasks,status,issuetype,priority"
			})}`;

			while (nextPage !== undefined) {
				try {
					const result = (await this._callWithOauth(nextPage)) as CardSearchResponse;

					// Logger.debug("GOT RESULT: " + JSON.stringify(result, null, 4));
					jiraCards.push(...result.issues);

					Logger.debug(`Jira: is last page? ${result.isLast} - nextPage ${result.nextPage}`);
					if (result.nextPage) {
						nextPage = result.nextPage.substring(result.nextPage.indexOf("/rest/api/2"));
					} else {
						Logger.debug("Jira: there are no more cards");
						nextPage = undefined;
					}
				} catch (e) {
					Container.instance().errorReporter.reportMessage({
						type: ReportingMessageType.Error,
						message: "Jira: Error fetching jira cards",
						source: "agent",
						extra: {
							message: e.message
						}
					});
					Logger.error(e);
					Logger.debug("Jira: Stopping card search");
					nextPage = undefined;
				}
			}

			Logger.debug(`Jira: total cards: ${jiraCards.length}`);
			const cards: ThirdPartyProviderCard[] = [];
			jiraCards.forEach(card => {
				const { fields = {} } = card;
				cards.push(makeCardFromJira(card, this.baseUrl));
				if (fields.subtasks && fields.subtasks.length) {
					// @ts-ignore
					fields.subtasks.forEach(subtask => {
						const tempCard = makeCardFromJira(subtask, this.baseUrl, card.id);
						// for sorting purposes
						tempCard.modifiedAt = card.modifiedAt;
						cards.push(tempCard);
					});
				}
			});
			return { cards };
		} catch (error) {
			debugger;
			Container.instance().errorReporter.reportMessage({
				type: ReportingMessageType.Error,
				message: "Jira: Error fetching jira cards",
				source: "agent",
				extra: { message: error.message }
			});
			Logger.error(error, "Error fetching jira cards");
			return { cards: [] };
		}
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
		const response = (await this._callWithOauth(
			"/rest/api/2/issue",
			"POST",
			body
		)) as CreateJiraIssueResponse;

		return {
			id: response.id,
			url: `${this.baseUrl}/browse/${response.key}`
		};
	}

	@log()
	async moveCard(request: MoveThirdPartyCardRequest) {
		try {
			Logger.debug("Jira Server: moving card");
			const response = await this._callWithOauth(
				`/rest/api/2/issue/${request.cardId}/transitions`,
				"POST",
				{
					transition: { id: request.listId }
				}
			);
			// Logger.debug("Got a response: " + JSON.stringify(response, null, 4));
			return response;
		} catch (error) {
			debugger;
			Container.instance().errorReporter.reportMessage({
				type: ReportingMessageType.Error,
				message: "Jira Server: Error moving jira card",
				source: "agent",
				extra: { message: error.message }
			});
			Logger.error(error, "Error moving jira card");
			return {};
		}
	}

	// apparently there's no way to get more than 1000 users
	// https://community.atlassian.com/t5/Jira-questions/Paging-is-broken-for-user-search-queries/qaq-p/712071
	@log()
	async getAssignableUsers(request: { boardId: string }) {
		const board = (this.boards || []).find(board => board.id === request.boardId);
		if (!board) {
			return { users: [] };
		}
		const result = (await this._callWithOauth(
			`/rest/api/2/user/assignable/search?${qs.stringify({
				project: board.key,
				maxResults: 1000
			})}`
		)) as JiraUser[];
		return { users: result.map(u => ({ ...u, id: u.accountId })) };
	}
}
