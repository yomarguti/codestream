"use strict";
import {
	ConfigureThirdPartyProviderRequest,
	ConfigureThirdPartyProviderRequestType,
	ConfigureThirdPartyProviderResponse,
	ConnectThirdPartyProviderRequest,
	ConnectThirdPartyProviderRequestType,
	ConnectThirdPartyProviderResponse,
	CreateThirdPartyCardRequest,
	CreateThirdPartyCardRequestType,
	CreateThirdPartyCardResponse,
	DisconnectThirdPartyProviderRequest,
	DisconnectThirdPartyProviderRequestType,
	DisconnectThirdPartyProviderResponse,
	FetchAssignableUsersRequest,
	FetchAssignableUsersRequestType,
	FetchThirdPartyBoardsRequest,
	FetchThirdPartyBoardsRequestType,
	FetchThirdPartyBoardsResponse
} from "../protocol/agent.protocol";
import { CodeStreamSession } from "../session";
import { getProvider, log, lsp, lspHandler } from "../system";

// NOTE: You must include all new providers here, otherwise the webpack build will exclude them
export * from "./trello";
export * from "./jira";
export * from "./github";
export * from "./gitlab";
export * from "./asana";
export * from "./bitbucket";
export * from "./youtrack";

@lsp
export class ThirdPartyProviderRegistry {
	constructor(public readonly session: CodeStreamSession) {}

	@log()
	@lspHandler(ConnectThirdPartyProviderRequestType)
	async connect(
		request: ConnectThirdPartyProviderRequest
	): Promise<ConnectThirdPartyProviderResponse> {
		const provider = getProvider(request.providerId);
		if (provider === undefined) {
			throw new Error(`No registered provider for '${request.providerId}'`);
		}

		await provider.connect();
		return {};
	}

	@log()
	@lspHandler(ConfigureThirdPartyProviderRequestType)
	async configure(
		request: ConfigureThirdPartyProviderRequest
	): Promise<ConfigureThirdPartyProviderResponse> {
		const provider = getProvider(request.providerId);
		if (provider === undefined) {
			throw new Error(`No registered provider for '${request.providerId}'`);
		}

		await provider.configure(request);
		return {};
	}

	@log()
	@lspHandler(DisconnectThirdPartyProviderRequestType)
	async disconnect(
		request: DisconnectThirdPartyProviderRequest
	): Promise<DisconnectThirdPartyProviderResponse> {
		const provider = getProvider(request.providerId);
		if (provider === undefined) return {};

		await provider.disconnect();
		return {};
	}

	@log()
	@lspHandler(FetchAssignableUsersRequestType)
	fetchAssignableUsers(request: FetchAssignableUsersRequest) {
		const provider = getProvider(request.providerId);
		if (provider === undefined) {
			throw new Error(`No registered provider for '${request.providerId}'`);
		}

		return provider.getAssignableUsers(request);
	}

	@log()
	@lspHandler(FetchThirdPartyBoardsRequestType)
	fetchBoards(request: FetchThirdPartyBoardsRequest): Promise<FetchThirdPartyBoardsResponse> {
		const provider = getProvider(request.providerId);
		if (provider === undefined) {
			throw new Error(`No registered provider for '${request.providerId}'`);
		}

		return provider.getBoards(request);
	}

	@log()
	@lspHandler(CreateThirdPartyCardRequestType)
	createCard(request: CreateThirdPartyCardRequest): Promise<CreateThirdPartyCardResponse> {
		const provider = getProvider(request.providerId);
		if (provider === undefined) {
			throw new Error(`No registered provider for '${request.providerId}'`);
		}

		return provider.createCard(request);
	}
}
