import { CSCodemark } from "@codestream/protocols/api";
import { action } from "../common";
import { CodemarksActionsTypes } from "./types";
import { HostApi } from "@codestream/webview/webview-api";
import { UpdateCodemarkRequestType } from "@codestream/protocols/agent";
import { logError } from "@codestream/webview/logger";

export const reset = () => action("RESET");

export const addCodemarks = (codemarks: CSCodemark[]) =>
	action(CodemarksActionsTypes.AddCodemarks, codemarks);

export const saveCodemarks = (codemarks: CSCodemark[]) =>
	action(CodemarksActionsTypes.SaveCodemarks, codemarks);

export const updateCodemarks = (codemarks: CSCodemark[]) =>
	action(CodemarksActionsTypes.UpdateCodemarks, codemarks);

type EditableAttributes = Partial<Pick<CSCodemark, "color" | "text" | "title" | "assignees">>;

export const editCodemark = (
	codemarkId: string,
	attributes: EditableAttributes
) => async dispatch => {
	try {
		const response = await HostApi.instance.send(UpdateCodemarkRequestType, {
			codemarkId,
			...attributes
		});
		dispatch(updateCodemarks([response.codemark]));
	} catch (error) {
		logError(`failed to update codemark: ${error}`, { codemarkId });
	}
};
