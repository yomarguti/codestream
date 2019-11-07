"use strict";
import { CodeStreamApiProvider } from "api/codestream/codestreamApi";
import { SlackSharingApiProvider } from "../api/slack/slackSharingApi";
import { SessionContainer } from "../container";
import {
	CreateThirdPartyCardRequest,
	CreateThirdPartyCardResponse,
	FetchThirdPartyBoardsRequest,
	FetchThirdPartyBoardsResponse
} from "../protocol/agent.protocol";
import { CSSlackProviderInfo } from "../protocol/api.protocol";
import { log, lspProvider } from "../system";
import { ThirdPartyProviderBase } from "./provider";

@lspProvider("slack")
export class SlackProvider extends ThirdPartyProviderBase<CSSlackProviderInfo> {
	get displayName() {
		return "Slack";
	}

	get name() {
		return "slack";
	}

	get headers() {
		return {
			Authorization: `Bearer ${this.accessToken}`
		};
	}

	async onConnected() {}

	private createProvider(): SlackSharingApiProvider {
		const session = SessionContainer.instance().session;
		const providerInfo = this._providerInfo as CSSlackProviderInfo;
		// TODO cheese
		const whatever = new SlackSharingApiProvider(
			session.api as CodeStreamApiProvider,
			(session.api as CodeStreamApiProvider).team,
			{
				accessToken: this.accessToken!,
				teamId: session.api.teamId,
				// this is the slack userId
				userId: providerInfo && providerInfo!.data && providerInfo!.data.user_id // session.api.userId
			},
			session.api.teamId,
			SessionContainer.instance().session.proxyAgent
		);
		return whatever;
	}

	@log()
	async getBoards(request: FetchThirdPartyBoardsRequest): Promise<FetchThirdPartyBoardsResponse> {
		await this.ensureConnected();

		// TODO cheese
		const whatever = this.createProvider();
		const streamsAsBoards = await whatever.fetchStreams({});
		return {
			boards: streamsAsBoards.streams.map(_ => {
				return {
					id: _.id,
					name: _.name!
				};
			})
		};
	}

	getConnectionData() {
		const data = super.getConnectionData();
		return { ...data, sharing: true };
	}

	// TODO use a createPost fn?
	@log()
	async createCard(request: CreateThirdPartyCardRequest): Promise<CreateThirdPartyCardResponse> {
		await this.ensureConnected();
		// TODO cheese
		const whatever = this.createProvider();
		const post = await whatever.createExternalPost({
			streamId: "CJ7PH1NDP",
			text: request.data.text,
			codemark: request.data.codemark
		});
		return post;
	}

	@log()
	async getAssignableUsers(request: { boardId: string }) {
		// TODO cheese
		// await this.ensureConnected();
		// const response = await this.get<GitLabUser[]>(`/projects/${request.boardId}/users`);
		// return { users: response.body.map(u => ({ ...u, displayName: u.name })) };
		throw Error("Not yet");
	}
}
