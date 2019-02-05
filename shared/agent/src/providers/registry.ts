"use strict";
import { CodeStreamSession } from "../session";
import {
	ConnectThirdPartyProviderRequest,
	ConnectThirdPartyProviderResponse,
	ConnectThirdParyProviderRequestType,
	DisconnectThirdPartyProviderRequest,
	DisconnectThirdPartyProviderResponse,
	DisconnectThirdParyProviderRequestType,
	FetchAssignableUsersRequest,
	FetchAssignableUsersRequestType
} from "../shared/agent.protocol";
import { getProvider, log, lsp, lspHandler } from "../system";

// NOTE: You must include all new providers here, otherwise the webpack build will exclude them
export * from "./trello";
export * from "./jira";
export * from "./github";
export * from "./gitlab";
export * from "./asana";
export * from "./bitbucket";

@lsp
export class ThirdPartyProviderRegistry {
	constructor(public readonly session: CodeStreamSession) {}

	@log()
	@lspHandler(ConnectThirdParyProviderRequestType)
	async connect(
		request: ConnectThirdPartyProviderRequest
	): Promise<ConnectThirdPartyProviderResponse> {
		const provider = getProvider(request.providerName);
		if (provider === undefined) {
			throw new Error(`No registered provider for '${request.providerName}'`);
		}

		await provider.connect();
		return {};
	}

	@log()
	@lspHandler(DisconnectThirdParyProviderRequestType)
	async disconnect(
		request: DisconnectThirdPartyProviderRequest
	): Promise<DisconnectThirdPartyProviderResponse> {
		const provider = getProvider(request.providerName);
		if (provider === undefined) return {};

		await provider.disconnect();
		return {};
	}

	@log()
	@lspHandler(FetchAssignableUsersRequestType)
	fetchAssignableUsers(request: FetchAssignableUsersRequest) {
		const provider = getProvider(request.providerName);
		if (provider === undefined) {
			throw new Error(`No registered provider for '${request.providerName}'`);
		}

		return provider.getAssignableUsers(request);
	}
}
