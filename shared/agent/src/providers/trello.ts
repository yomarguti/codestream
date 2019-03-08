"use strict";
import * as qs from "querystring";
import {
	CreateThirdPartyCardRequest,
	FetchThirdPartyBoardsRequest,
	FetchThirdPartyBoardsResponse,
	TrelloBoard,
	TrelloCreateCardRequest,
	TrelloCreateCardResponse,
	TrelloList,
	TrelloMember
} from "../protocol/agent.protocol";
import { CSTrelloProviderInfo } from "../protocol/api.protocol";
import { log, lspProvider } from "../system";
import { ThirdPartyProviderBase } from "./provider";

@lspProvider("trello")
export class TrelloProvider extends ThirdPartyProviderBase<CSTrelloProviderInfo> {
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
	async getBoards(
		request: FetchThirdPartyBoardsRequest
	): Promise<FetchThirdPartyBoardsResponse> {
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
	async createCard(request: CreateThirdPartyCardRequest) {
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
