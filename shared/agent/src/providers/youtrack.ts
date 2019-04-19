"use strict";
import * as qs from "querystring";
import {
	CreateThirdPartyCardRequest,
	FetchThirdPartyBoardsRequest,
	FetchThirdPartyBoardsResponse,
	YouTrackBoard,
	YouTrackCreateCardRequest,
	YouTrackCreateCardResponse,
	YouTrackUser
} from "../protocol/agent.protocol";
import { CSYouTrackProviderInfo } from "../protocol/api.protocol";
import { log, lspProvider } from "../system";
import { ThirdPartyProviderBase } from "./provider";

@lspProvider("youtrack")
export class YouTrackProvider extends ThirdPartyProviderBase<CSYouTrackProviderInfo> {

	get displayName() {
		return "YouTrack";
	}

	get name() {
		return "youtrack";
	}

	get headers() {
		return {
			Authorization: `Bearer ${this.accessToken}`,
			Accept: "application/json",
			"Content-Type": "application/json"
		};
	}

	get apiPath () {
		return "/youtrack/api";
	}

	async onConnected() {
	}

	@log()
	async getBoards(
		request: FetchThirdPartyBoardsRequest
	): Promise<FetchThirdPartyBoardsResponse> {
		// have to force connection here because we need accessToken to even create our request
		await this.ensureConnected();
		const response = await this.get<YouTrackBoard[]>(
			`/admin/projects?${qs.stringify({
				fields: "id,name,shortName"
			})}`
		);
		return {
			boards: response.body.map(board => { 
				return { 
					id: board.id,
					name: board.name,
					singleAssignee: true
				 };
			})
		};
	}

	@log()
	async createCard(request: CreateThirdPartyCardRequest) {
		const data = request.data as YouTrackCreateCardRequest;
		const response = await this.post<{}, YouTrackCreateCardResponse>(
			`/issues?${qs.stringify({
				fields: "id,idReadable"
			})}`,
			{
				summary: data.name,
				description: data.description,
				project: {
					id: data.boardId
				}
			}
		);
		const card = response.body;
		const { host, apiHost, isEnterprise } = this.providerInstance;
		const returnHost = isEnterprise ? host : apiHost;
		card.url = `https://${returnHost}/youtrack/issue/${card.idReadable}`;
		return card;
	}

	@log()
	async getAssignableUsers(request: { boardId: string }) {
		const { body } = await this.get<YouTrackUser[]>(
			`/admin/users/?${qs.stringify({
				fields: "id,name,fullName"
			})}`
		);
		return { users: body.map(u => ({ ...u, displayName: u.fullName })) };
	}
}
