"use strict";
import { CodeStreamApiProvider } from "api/codestream/codestreamApi";
import { sortBy } from "lodash-es";
import { SlackSharingApiProvider } from "../api/slack/slackSharingApi";
import { SessionContainer } from "../container";
import {
	CreateThirdPartyPostRequest,
	CreateThirdPartyPostResponse,
	FetchThirdPartyChannelsRequest,
	FetchThirdPartyChannelsResponse
} from "../protocol/agent.protocol";
import { CSSlackProviderInfo, StreamType } from "../protocol/api.protocol";
import { log, lspProvider } from "../system";
import { ThirdPartyPostProviderBase } from "./provider";

@lspProvider("slack")
export class SlackProvider extends ThirdPartyPostProviderBase<CSSlackProviderInfo> {
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

	private createClient(): SlackSharingApiProvider {
		const session = SessionContainer.instance().session;
		const providerInfo = this._providerInfo as CSSlackProviderInfo;

		const slackApi = new SlackSharingApiProvider(
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
		return slackApi;
	}

	getConnectionData() {
		const data = super.getConnectionData();
		return { ...data, sharing: true };
	}

	@log()
	async getChannels(
		request: FetchThirdPartyChannelsRequest
	): Promise<FetchThirdPartyChannelsResponse> {
		await this.ensureConnected();

		const slackClient = this.createClient();
		const streams = await slackClient.fetchStreams({});
		const channels = sortBy(
			streams.streams.map(_ => {
				return {
					id: _.id,
					name: _.name!,
					type: _.type,
					order: _.type === StreamType.Channel ? 0 : _.type === StreamType.Direct ? 2 : 1
				};
			}),
			[_ => _.order, _ => _.name]
		);
		return {
			channels: channels
		};
	}

	@log()
	async createPost(request: CreateThirdPartyPostRequest): Promise<CreateThirdPartyPostResponse> {
		await this.ensureConnected();

		const slackClient = this.createClient();
		const post = await slackClient.createExternalPost({
			channelId: request.channelId, // "CJ7PH1NDP",
			text: request.text,
			codemark: request.codemark
		});
		return post;
	}
}
