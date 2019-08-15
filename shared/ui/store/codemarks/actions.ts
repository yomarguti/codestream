import { CSCodemark } from "@codestream/protocols/api";
import { action } from "../common";
import { CodemarksActionsTypes } from "./types";
import { HostApi } from "@codestream/webview/webview-api";
import {
	UpdateCodemarkRequestType,
	DeleteCodemarkRequestType,
	PinReplyToCodemarkRequestType,
	CodemarkPlus
} from "@codestream/protocols/agent";
import { logError } from "@codestream/webview/logger";

export const reset = () => action("RESET");

export const addCodemarks = (codemarks: CSCodemark[]) =>
	action(CodemarksActionsTypes.AddCodemarks, codemarks);

export const saveCodemarks = (codemarks: CSCodemark[]) =>
	action(CodemarksActionsTypes.SaveCodemarks, codemarks);

export const updateCodemarks = (codemarks: CSCodemark[]) =>
	action(CodemarksActionsTypes.UpdateCodemarks, codemarks);

export const _deleteCodemark = (codemarkId: string) =>
	action(CodemarksActionsTypes.Delete, codemarkId);

export const deleteCodemark = (codemarkId: string) => async dispatch => {
	try {
		void (await HostApi.instance.send(DeleteCodemarkRequestType, {
			codemarkId
		}));
		dispatch(_deleteCodemark(codemarkId));
	} catch (error) {
		logError(`failed to delete codemark: ${error}`, { codemarkId });
	}
};

type EditableAttributes = Partial<
	Pick<CSCodemark, "tags" | "text" | "title" | "assignees" | "relatedCodemarkIds">
>;

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

export const pinReply = (codemark: CodemarkPlus, postId: string) => () => {
	if (codemark.pinnedReplies && codemark.pinnedReplies.includes(postId)) return;

	HostApi.instance.send(PinReplyToCodemarkRequestType, {
		codemarkId: codemark.id,
		postId,
		value: true
	});
};

export const unpinReply = (codemark: CodemarkPlus, postId: string) => () => {
	if (!codemark.pinnedReplies || !codemark.pinnedReplies.includes(postId)) return;

	HostApi.instance.send(PinReplyToCodemarkRequestType, {
		codemarkId: codemark.id,
		postId,
		value: false
	});
};
