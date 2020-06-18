"use strict";
import * as qs from "querystring";
import { Logger } from "../logger";
import {
	CreateThirdPartyCardRequest,
	FetchThirdPartyBoardsRequest,
	FetchThirdPartyBoardsResponse,
	FetchThirdPartyCardsRequest,
	FetchThirdPartyCardsResponse,
	TrelloBoard,
	TrelloCard,
	TrelloCreateCardRequest,
	TrelloCreateCardResponse,
	TrelloMember
} from "../protocol/agent.protocol";
import { CSTrelloProviderInfo } from "../protocol/api.protocol";
import { log, lspProvider } from "../system";
import { ApiResponse, ThirdPartyIssueProviderBase } from "./provider";

@lspProvider("trello")
export class TrelloProvider extends ThirdPartyIssueProviderBase<CSTrelloProviderInfo> {
	private _trelloUserId: string | undefined;

	get displayName() {
		return "Trello";
	}

	get name() {
		return "trello";
	}

	get headers() {
		return {};
	}

	private get apiKey() {
		return this._providerInfo && this._providerInfo.apiKey;
	}

	async onConnected() {
		this._trelloUserId = await this.getMemberId();
	}

	@log()
	async getBoards(request: FetchThirdPartyBoardsRequest): Promise<FetchThirdPartyBoardsResponse> {
		// have to force connection here because we need apiKey and accessToken to even create our request
		await this.ensureConnected();

		const response = await this.get<TrelloBoard[]>(
			`/members/${this._trelloUserId}/boards?${qs.stringify({
				filter: "open",
				fields: "id,name,desc,descData,closed,idOrganization,pinned,url,labelNames,starred",
				lists: "open",
				key: this.apiKey,
				token: this.accessToken
			})}`
		);

		return {
			boards: request.organizationId
				? response.body.filter(b => b.idOrganization === request.organizationId)
				: response.body
		};
	}

	@log()
	async getCards(request: FetchThirdPartyCardsRequest): Promise<FetchThirdPartyCardsResponse> {
		// have to force connection here because we need apiKey and accessToken to even create our request
		await this.ensureConnected();

		let response: ApiResponse<TrelloCard[]>;

		if (request.assignedToMe) {
			response = await this.get<TrelloCard[]>(
				`/members/${this._trelloUserId}/cards?${qs.stringify({
					cards: "open",
					fields:
						"id,name,desc,url,idList,idBoard,idOrganization,dateLastActivity,shortLink,idShort",
					key: this.apiKey,
					token: this.accessToken
				})}`
			);
		} else if (request.assignedToAnyone) {
			response = await this.get<TrelloCard[]>(
				`/cards?${qs.stringify({
					cards: "open",
					fields:
						"id,name,desc,url,idList,idBoard,idOrganization,dateLastActivity,shortLink,idShort",
					key: this.apiKey,
					token: this.accessToken
				})}`
			);
		} else if (request.unassigned) {
			response = await this.get<TrelloCard[]>(
				`/members/${this._trelloUserId}/cards?${qs.stringify({
					cards: "open",
					fields:
						"id,name,desc,url,idList,idBoard,idOrganization,dateLastActivity,shortLink,idShort",
					key: this.apiKey,
					token: this.accessToken
				})}`
			);
		} else {
			response = await this.get<TrelloCard[]>(
				`/lists/${request.listId}/cards?${qs.stringify({
					cards: "open",
					fields:
						"id,name,desc,url,idList,idBoard,idOrganization,dateLastActivity,shortLink,idShort",
					key: this.apiKey,
					token: this.accessToken
				})}`
			);
		}

		const cards = request.organizationId
			? response.body.filter(c => c.idOrganization === request.organizationId)
			: response.body;
		cards.forEach(card => (card.modifiedAt = new Date(card.dateLastActivity).getTime()));
		cards.sort((a, b) => b.modifiedAt - a.modifiedAt);
		return { cards };
	}

	@log()
	async createCard(request: CreateThirdPartyCardRequest) {
		await this.ensureConnected();

		const data = request.data as TrelloCreateCardRequest;
		const response = await this.post<{}, TrelloCreateCardResponse>(
			`/cards?${qs.stringify({
				idList: data.listId,
				name: data.name,
				desc: data.description,
				key: this.apiKey,
				idMembers: (data.assignees! || []).map(a => a.id),
				token: this.accessToken
			})}`,
			{}
		);
		return response.body;
	}

	@log()
	async getAssignableUsers(request: { boardId: string }) {
		await this.ensureConnected();

		const { body } = await this.get<TrelloMember[]>(
			`/boards/${request.boardId}/members?${qs.stringify({
				key: this.apiKey,
				token: this.accessToken,
				fields: "id,email,username,fullName"
			})}`
		);
		return { users: body.map(u => ({ ...u, displayName: u.fullName })) };
	}

	private async getMemberId() {
		const tokenResponse = await this.get<{ idMember: string; [key: string]: any }>(
			`/token/${this.accessToken}?${qs.stringify({ key: this.apiKey, token: this.accessToken })}`
		);

		return tokenResponse.body.idMember;
	}
}
