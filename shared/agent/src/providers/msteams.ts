"use strict";
import { sortBy } from "lodash-es";
import {
	CreateThirdPartyPostRequest,
	CreateThirdPartyPostResponse,
	FetchThirdPartyChannelsRequest,
	FetchThirdPartyChannelsResponse,
	ThirdPartyDisconnect
} from "../protocol/agent.protocol";
import { MSTeamsProviderInfo } from "../protocol/api.protocol";
import { log, lspProvider } from "../system";
import { openUrl } from "../system/openUrl";
import { ThirdPartyPostProviderBase } from "./provider";

@lspProvider("msteams")
export class MSTeamsProvider extends ThirdPartyPostProviderBase<MSTeamsProviderInfo> {
	get displayName() {
		return "MSTeams";
	}

	get name() {
		return "msteams";
	}

	get headers() {
		return {
			// this is unused
			Authorization: ""
		};
	}

	private _multiProviderInfo: MSTeamsProviderInfo | undefined;

	async onConnecting() {
		await openUrl("https://github.com/TeamCodeStream/CodeStream/wiki/Microsoft-Teams-Integration");
	}
	protected async onConnected(providerInfo: MSTeamsProviderInfo) {
		this._multiProviderInfo = providerInfo;
	}

	protected async onDisconnected(request?: ThirdPartyDisconnect) {
		if (!request || !request.providerTeamId) return;

		if (this._multiProviderInfo && this._multiProviderInfo.multiple) {
			delete this._multiProviderInfo.multiple[request.providerTeamId];
		}
	}

	getConnectionData() {
		const data = super.getConnectionData();
		return { ...data, sharing: true };
	}

	async refreshToken(request?: { providerTeamId?: string }) {
		// override as it's not required
	}

	@log()
	async getChannels(
		request: FetchThirdPartyChannelsRequest
	): Promise<FetchThirdPartyChannelsResponse> {
		// fetching the channels will check to see if it's connected or not
		const response = await this.session.api.fetchMsTeamsConversations({
			tenantId: request.providerTeamId
		});
		const channels = sortBy(
			response.msteams_conversations.map((_: any) => {
				return {
					id: _.conversationId,
					name: `${_.teamName}/${_.channelName}`,
					type: "channel"
				};
			}),
			[_ => _.name]
		);
		return {
			channels: channels
		};
	}

	@log()
	async createPost(request: CreateThirdPartyPostRequest): Promise<CreateThirdPartyPostResponse> {
		const result = await this.session.api.triggerMsTeamsProactiveMessage({
			codemarkId: request.codemark && request.codemark.id,
			reviewId: request.review && request.review.id,
			providerTeamId: request.providerTeamId,
			channelId: request.channelId
		});
		return {
			post: undefined
		};
	}
}
