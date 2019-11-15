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

	private _clientCache: { [key: string]: SlackSharingApiProvider } | undefined;
	private _lastTeamId: string | undefined;
	private _multiProviderInfo: CSSlackProviderInfo | undefined;

	async connect() {
		if (this._multiProviderInfo !== undefined && super.isReady()) {
			this._multiProviderInfo = undefined;
			this._clientCache = undefined;
			this.resetReady();
		}
		super.connect();
	}

	private createClient(providerInfo: CSSlackProviderInfo): SlackSharingApiProvider {
		const session = SessionContainer.instance().session;
		const slackApi = new SlackSharingApiProvider(
			session.api as CodeStreamApiProvider,
			(session.api as CodeStreamApiProvider).team,
			{
				accessToken: providerInfo.accessToken!,
				teamId: session.api.teamId,
				// this is the slack userId
				userId: providerInfo && providerInfo!.data && providerInfo!.data.user_id // session.api.userId
			},
			// codestream teamId
			session.api.teamId,
			SessionContainer.instance().session.proxyAgent
		);
		return slackApi;
	}

	protected async onConnected(providerInfo: CSSlackProviderInfo) {
		this._multiProviderInfo = providerInfo;
	}

	private getClient(providerTeamId: string) {
		if (!this._multiProviderInfo) return undefined;

		if (!this._clientCache) {
			this._clientCache = {};
		}
		let cachedClient = this._clientCache![providerTeamId];
		if (!cachedClient) {
			cachedClient = this._clientCache[providerTeamId] = this.createClient(
				this._multiProviderInfo!.multiple![providerTeamId]!
			);
		}

		return cachedClient;
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
		this._lastTeamId = request.providerTeamId;

		const slackClient = this.getClient(request.providerTeamId);
		if (!slackClient) {
			return {
				channels: []
			};
		}
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
		this._lastTeamId = request.providerTeamId;

		const slackClient = this.getClient(request.providerTeamId);
		if (!slackClient) {
			return { post: undefined };
		}
		const post = await slackClient.createExternalPost(request);
		return post;
	}
}
