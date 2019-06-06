import { action } from "../common";
import { ProvidersState, ProvidersActionsType } from "./types";
import { HostApi } from "../../webview-api";
import {
	ConnectThirdPartyProviderRequestType,
	ConfigureThirdPartyProviderRequestType,
	AddEnterpriseProviderRequestType,
	DisconnectThirdPartyProviderRequestType,
	TelemetryRequestType
} from "@codestream/protocols/agent";
import { logError } from "../../logger";
import { setIssueProvider } from "../context/actions";

export const reset = () => action("RESET");

export const updateProviders = (data: ProvidersState) => action(ProvidersActionsType.Update, data);

export const connectProvider = (providerId: string, fromMenu = false) => async (
	dispatch,
	getState
) => {
	const { context, users, session, providers } = getState();
	const provider = providers[providerId];
	if (!provider) return;
	const user = users[session.userId];
	const { name, host, isEnterprise } = provider;
	let providerInfo = ((user.providerInfo || {})[context.currentTeamId] || {})[name];
	if (providerInfo && isEnterprise) {
		providerInfo = (providerInfo.hosts || {})[host];
	}
	if (providerInfo && providerInfo.accessToken) {
		if (provider.hasIssues) {
			dispatch(setIssueProvider(providerId));
		}
		return;
	}
	try {
		const api = HostApi.instance;
		await api.send(ConnectThirdPartyProviderRequestType, { providerId });
		if (provider.hasIssues) {
			dispatch(sendIssueProviderConnected(providerId, fromMenu));
			return dispatch(setIssueProvider(providerId));
		}
	} catch (error) {
		logError(`Failed to connect ${provider.name}: ${error}`);
	}
};

export const sendIssueProviderConnected = (providerId: string, fromMenu = false) => async (
	dispatch,
	getState
) => {
	const { providers } = getState();
	const provider = providers[providerId];
	if (!provider) return;
	const { name, host, isEnterprise } = provider;
	const api = HostApi.instance;
	api.send(TelemetryRequestType, {
		eventName: "Issue Service Connected",
		properties: {
			Service: name,
			Host: isEnterprise ? host : null,
			Connection: "On",
			"Connection Location": fromMenu ? "Global Nav" : "Compose Modal"
		}
	});
};

export const configureProvider = (
	providerId: string,
	data: { [key: string]: any },
	fromMenu = false,
	setConnectedWhenConfigured = false
) => async (
	dispatch,
	getState
) => {
	const { providers } = getState();
	const provider = providers[providerId];
	if (!provider) return;
	try {
		const api = HostApi.instance;
		await api.send(ConfigureThirdPartyProviderRequestType, { providerId, data });
		api.send(TelemetryRequestType, {
			eventName: "Issue Service Configured",
			properties: {
				Service: provider.name
			}
		});

		// for some providers (namely YouTrack), configuring is as good as connecting,
		// since we allow the user to set their own access token
		if (setConnectedWhenConfigured && provider.hasIssues) {
			dispatch(sendIssueProviderConnected(providerId, fromMenu));
			dispatch(setIssueProvider(providerId));
		}
	} catch (error) {
		logError(`Failed to connect ${provider.name}: ${error}`);
	}
};

export const addEnterpriseProvider = (
	providerId: string,
	host: string,
	data: { [key: string]: any },
	fromMenu = false
) => async (
	dispatch,
	getState
) => {
	const { providers } = getState();
	const provider = providers[providerId];
	if (!provider) return;
	try {
		const api = HostApi.instance;
		const response = await api.send(AddEnterpriseProviderRequestType, { providerId, host, data });
		api.send(TelemetryRequestType, {
			eventName: "Issue Service Configured",
			properties: {
				Service: provider.name
			}
		});
		return response.providerId;
	} catch (error) {
		logError(`Failed to add enterprise provider for ${provider.name}: ${error}`);
		return "";
	}
};

export const disconnectProvider = (providerId: string, fromMenu = false) => async (
	dispatch,
	getState
) => {
	try {
		const { providers } = getState();
		const provider = providers[providerId];
		if (!provider) return;
		const api = HostApi.instance;
		await api.send(DisconnectThirdPartyProviderRequestType, { providerId });
		api.send(TelemetryRequestType, {
			eventName: "Issue Service Connected",
			properties: {
				Service: provider.name,
				Host: provider.isEnterprise ? provider.host : null,
				Connection: "Off",
				"Connection Location": fromMenu ? "Global Nav" : "Compose Modal"
			}
		});
		if (getState().context.issueProvider.host === provider.host) {
			dispatch(setIssueProvider(undefined));
		}
	} catch (error) {
		logError(`failed to disconnect service ${providerId}: ${error}`);
	}
};

