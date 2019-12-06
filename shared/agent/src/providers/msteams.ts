"use strict";
import { CodeStreamApiProvider } from "api/codestream/codestreamApi";
import { sortBy } from "lodash-es";
import { MSTeamsSharingApiProvider } from "../api/teams/teamsSharingApi";
import { SessionContainer } from "../container";
import {
	CreateThirdPartyPostRequest,
	CreateThirdPartyPostResponse,
	FetchThirdPartyChannelsRequest,
	FetchThirdPartyChannelsResponse,
	ThirdPartyDisconnect
} from "../protocol/agent.protocol";
import { MSTeamsProviderInfo, StreamType } from "../protocol/api.protocol";
import { log, lspProvider } from "../system";
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
			Authorization: `Bearer ${this.accessToken}`
		};
	}

	private _clientCache: { [key: string]: MSTeamsSharingApiProvider } | undefined;
	private _lastTeamId: string | undefined;
	private _multiProviderInfo: MSTeamsProviderInfo | undefined;

	async connect() {
		if (this._multiProviderInfo !== undefined && super.isReady()) {
			this._multiProviderInfo = undefined;
			this._clientCache = undefined;
			this.resetReady();
		}
		super.connect();
	}

	private createClient(providerInfo: MSTeamsProviderInfo): MSTeamsSharingApiProvider {
		const session = SessionContainer.instance().session;

		const msTeamsApi = new MSTeamsSharingApiProvider(
			session.api as CodeStreamApiProvider,
			(session.api as CodeStreamApiProvider).team,
			{
				expiresAt: providerInfo.data!.expiresAt,
				data: {
					expires_in: providerInfo.data!.expires_in,
					scope: providerInfo.data!.scope,
					token_type: providerInfo.data!.token_type
				},
				refreshToken: providerInfo.data!.refreshToken,
				accessToken: providerInfo.accessToken!,
				teamId: session.api.teamId,
				// this is the msTeams userId
				userId: providerInfo && providerInfo!.extra && providerInfo!.extra.user_id
			},
			session.api.userId,
			session.api.teamId,
			new Map([[providerInfo.extra!.team_id, providerInfo.extra!.team_name]])
		);
		return msTeamsApi;
	}

	protected async onConnected(providerInfo: MSTeamsProviderInfo) {
		this._multiProviderInfo = providerInfo;
	}

	protected async onDisconnected(request?: ThirdPartyDisconnect) {
		if (!request || !request.providerTeamId) return;

		if (this._clientCache) {
			const client = this._clientCache[request.providerTeamId];
			if (client) {
				if (client.dispose) {
					await client.dispose();
				}
				delete this._clientCache[request.providerTeamId];
			}
		}
		if (this._multiProviderInfo && this._multiProviderInfo.multiple) {
			delete this._multiProviderInfo.multiple[request.providerTeamId];
		}
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

	async refreshToken(request?: {providerTeamId?: string}) {
		if (this._providerInfo === undefined || !request || !request.providerTeamId) {
			return;
		}
		const providerTeamId = request!.providerTeamId;
		const value = this._providerInfo!.multiple![providerTeamId];
		const oneMinuteBeforeExpiration = value.expiresAt - 1000 * 60;
		if (oneMinuteBeforeExpiration > new Date().getTime()) return;

		try {
			const me = await this.session.api.refreshThirdPartyProvider({
				providerId: this.providerConfig.id,
				refreshToken: value.refreshToken,
				sharing: true,
				subId: providerTeamId
			});
			this._providerInfo = this.getProviderInfo(me);
		} catch (error) {
			await this.disconnect();
			return this.ensureConnected();
		}
	}

	@log()
	async getChannels(
		request: FetchThirdPartyChannelsRequest
	): Promise<FetchThirdPartyChannelsResponse> {
		await this.ensureConnected(request);
		this._lastTeamId = request.providerTeamId;

		const teamsClient = this.getClient(request.providerTeamId);
		if (!teamsClient) {
			return {
				channels: []
			};
		}
		const streams = await teamsClient.fetchStreams({});
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
		await this.ensureConnected(request);
		this._lastTeamId = request.providerTeamId;

		const slackClient = this.getClient(request.providerTeamId);
		if (!slackClient) {
			return { post: undefined };
		}
		const post = await slackClient.createExternalPost(request);
		return post;
	}
}
