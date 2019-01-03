"use strict";
import { CodeStreamSession } from "../session";
import {
	ConnectThirdParyProviderRequest,
	ConnectThirdParyProviderRequestType,
	DisconnectThirdParyProviderRequest,
	DisconnectThirdParyProviderRequestType
} from "../shared/agent.protocol";
import { getProvider, log, lsp, lspHandler } from "../system";

// NOTE: You must include all new providers here, otherwise the webpack build will exclude them
export * from "./trello";
export * from "./jira";

@lsp
export class ThirdPartyProviderRegistry {
	constructor(public readonly session: CodeStreamSession) {}

	@log()
	@lspHandler(ConnectThirdParyProviderRequestType)
	connect(request: ConnectThirdParyProviderRequest) {
		const provider = getProvider(request.providerName);
		if (provider === undefined) {
			throw new Error(`No registered provider for '${request.providerName}'`);
		}

		return provider.connect(request);
	}

	@log()
	@lspHandler(DisconnectThirdParyProviderRequestType)
	disconnect(request: DisconnectThirdParyProviderRequest) {
		const provider = getProvider(request.providerName);
		if (provider === undefined) return;

		return provider.disconnect(request);
	}
}
