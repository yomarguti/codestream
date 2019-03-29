import {
	ConnectThirdPartyProviderRequestType,
	DisconnectThirdPartyProviderRequestType,
	TelemetryRequestType,
	ThirdPartyProviderConfig
} from "@codestream/protocols/agent";
import { logError } from "../../logger";
import { setUserPreference } from "../../Stream/actions";
import { HostApi } from "../../webview-api";
import { action } from "../common";
import { ContextActionsType, State } from "./types";

export const reset = () => action("RESET");

export const setContext = (payload: Partial<State>) =>
	action(ContextActionsType.SetContext, payload);

export const _openPanel = (panel: string) => action(ContextActionsType.OpenPanel, panel);
export const openPanel = (panel: string) => (dispatch, getState) => {
	if (getState().context.panelStack[0] !== panel) {
		return dispatch(_openPanel(panel));
	}
};

export const closePanel = () => action(ContextActionsType.ClosePanel);

export const focus = () => action(ContextActionsType.SetFocusState, true);

export const blur = () => action(ContextActionsType.SetFocusState, false);

export const setCodemarkFileFilter = (value: string) =>
	action(ContextActionsType.SetCodemarkFileFilter, value);

export const setCodemarkTypeFilter = (value: string) =>
	action(ContextActionsType.SetCodemarkTypeFilter, value);

export const setCodemarkColorFilter = (value: string) =>
	action(ContextActionsType.SetCodemarkColorFilter, value);

export const _setChannelFilter = (value: string) =>
	action(ContextActionsType.SetChannelFilter, value);

export const setChannelFilter = (value: string) => async dispatch => {
	if (value !== "selecting") {
		// if a filter is selected, only update user preferences
		// the context reducer will update the `channelFilter` on the preferences change
		return await dispatch(setUserPreference(["showChannels"], value));
	}
	return dispatch(_setChannelFilter(value));
};

export const _setCurrentStream = (streamId?: string, threadId?: string) =>
	action(ContextActionsType.SetCurrentStream, { streamId, threadId });

export const setCurrentStream = (streamId?: string, threadId?: string) => (dispatch, getState) => {
	if (streamId === undefined && threadId !== undefined) {
		const error = new Error("setCurrentStream was called with a threadId but no streamId");
		logError(error);
		throw error;
	}
	const { context } = getState();
	const streamChanged = context.currentStreamId !== streamId;
	const threadChanged = context.threadId !== threadId;
	if (streamChanged || threadChanged) {
		return dispatch(_setCurrentStream(streamId, threadId));
	}
};

export const connectProvider = (provider: ThirdPartyProviderConfig, fromMenu = false) => async (dispatch, getState) => {
	const { context, users, session } = getState();
	const user = users[session.userId];
	const { name, host, isEnterprise } = provider;
	let providerInfo = ((user.providerInfo || {})[context.currentTeamId] || {})[name];
	if (providerInfo) {
		if (isEnterprise) {
			const starredHost = host.replace(/\./g, '*');
			providerInfo = (providerInfo.hosts || {})[starredHost];
		}
		if (providerInfo && providerInfo.accessToken) {
			if (provider.hasIssues) {
				dispatch(setIssueProvider(provider));
			}
			return;
		}
	}
	try {
		const api = HostApi.instance;
		await api.send(ConnectThirdPartyProviderRequestType, { provider });
		api.send(TelemetryRequestType, {
			eventName: "Issue Service Connected",
			properties: {
				Service: provider.name,
				Connection: "On",
				"Connection Location": fromMenu ? "Global Nav" : "Compose Modal"
			}
		});
		if (provider.hasIssues) {
			return dispatch(setIssueProvider(provider));
		}
	} catch (error) {
		logError(`Failed to connect ${provider.name}: ${error}`);
	}
};

export const disconnectProvider = (provider: ThirdPartyProviderConfig, fromMenu = false) => async (dispatch, getState) => {
	try {
		const api = HostApi.instance;
		await api.send(DisconnectThirdPartyProviderRequestType, { provider });
		api.send(TelemetryRequestType, {
			eventName: "Issue Service Connected",
			properties: {
				Service: provider.name,
				Connection: "Off",
				"Connection Location": fromMenu ? "Global Nav" : "Compose Modal"
			}
		});
		if (getState().context.issueProvider.host === provider.host) {
			dispatch(setIssueProvider(undefined));
		}
	} catch (error) {
		logError(`failed to disconnect service ${provider.name}: ${error}`);
	}
};

export const setIssueProvider = (provider: ThirdPartyProviderConfig | undefined) =>
	action(ContextActionsType.SetIssueProvider, provider);
