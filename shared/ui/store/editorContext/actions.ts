import { Range } from "vscode-languageserver-types";
import { action } from "../common";
import { State, EditorContextActionsType } from "./types";
import { HostApi } from "@codestream/webview/webview-api";
import { GetRangeScmInfoRequestType } from "@codestream/protocols/agent";

export const reset = () => action("RESET");

export const setEditorContext = (payload: Partial<State>) =>
	action(EditorContextActionsType.SetEditorContext, payload);

export const setCurrentFile = (file: string) =>
	action(EditorContextActionsType.SetCurrentFile, file);

// Text editor context
export const getScmInfoForSelection = (uri: string, range: Range) => async dispatch => {
	const scm = await HostApi.instance.send(GetRangeScmInfoRequestType, {
		dirty: true, // should this be determined here? using true to be safe
		uri,
		range
	});

	dispatch(setEditorContext({ scm }));
};
