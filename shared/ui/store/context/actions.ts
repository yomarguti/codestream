import {
	ConnectThirdParyProviderRequestType,
	DisconnectThirdPartyProviderRequestType,
	TelemetryRequestType
} from "@codestream/protocols/agent";
import { DidChangeActiveStreamNotificationType } from "../../ipc/webview.protocol";
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

export function setThread(streamId: string, threadId: string | null = null) {
	return action(ContextActionsType.SetThread, { streamId, threadId });
}

export const setCodemarkFileFilter = (value: string) =>
	action(ContextActionsType.SetCodeMarkFileFilter, value);

export const setCodemarkTypeFilter = (value: string) =>
	action(ContextActionsType.SetCodemarkTypeFilter, value);

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

export const fileChanged = editor => setCurrentFile(editor.fileName, editor.fileStreamId);

export const setCurrentFile = (file = "", fileStreamId?: string) =>
	action(ContextActionsType.SetCurrentFile, { file, fileStreamId });

export const _setCurrentStream = (streamId?: string) =>
	action(ContextActionsType.SetCurrentStream, streamId);
export const setCurrentStream = (streamId?: string) => (dispatch, getState) => {
	const { context } = getState();
	// don't set the stream ID unless it actually changed
	if (context.currentStreamId !== streamId) {
		HostApi.instance.send(DidChangeActiveStreamNotificationType, { streamId });
		return dispatch(_setCurrentStream(streamId));
	}
};

export const connectProvider = (name: string, fromMenu = false) => async (dispatch, getState) => {
	const { context, users, session } = getState();
	const user = users[session.userId];
	if (((user.providerInfo && user.providerInfo[context.currentTeamId]) || {})[name]) {
		return dispatch(setIssueProvider(name));
	}
	try {
		const api = HostApi.instance;
		await api.send(ConnectThirdParyProviderRequestType, { providerName: name });
		api.send(TelemetryRequestType, {
			eventName: "Issue Service Connected",
			properties: {
				Service: name,
				Connection: "On",
				"Connection Location": fromMenu ? "Global Nav" : "Compose Modal"
			}
		});
		return dispatch(setIssueProvider(name));
	} catch (error) {
		logError(`Failed to connect ${name}: ${error}`);
	}
};

export const disconnectService = (name: string, fromMenu = false) => async (
	dispatch,
	getState
) => {
	try {
		const api = HostApi.instance;
		await api.send(DisconnectThirdPartyProviderRequestType, {
			providerName: name
		});
		api.send(TelemetryRequestType, {
			eventName: "Issue Service Connected",
			properties: {
				Service: name,
				Connection: "Off",
				"Connection Location": fromMenu ? "Global Nav" : "Compose Modal"
			}
		});
		if (getState().context.issueProvider === name) {
			dispatch(setIssueProvider(undefined));
		}
	} catch (error) {
		logError(`failed to disconnect service ${name}: ${error}`);
	}
};

export const setIssueProvider = (name: string | undefined) =>
	action(ContextActionsType.SetIssueProvider, name);
