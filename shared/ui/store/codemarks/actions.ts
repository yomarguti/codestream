import { CSCodemark, CodemarkType } from "@codestream/protocols/api";
import { action } from "../common";
import { CodemarksActionsTypes } from "./types";
import { HostApi } from "@codestream/webview/webview-api";
import {
	UpdateCodemarkRequestType,
	DeleteCodemarkRequestType,
	PinReplyToCodemarkRequestType,
	CodemarkPlus,
	GetRangeScmInfoResponse,
	CrossPostIssueValues,
	CreateShareableCodemarkRequestType,
	CreateThirdPartyPostRequestType
} from "@codestream/protocols/agent";
import { logError } from "@codestream/webview/logger";
import { codemarks as codemarkApi } from "../../Stream/api-functions";
import { addStreams } from "../streams/actions";

export const reset = () => action("RESET");

export const addCodemarks = (codemarks: CSCodemark[]) =>
	action(CodemarksActionsTypes.AddCodemarks, codemarks);

export const saveCodemarks = (codemarks: CSCodemark[]) =>
	action(CodemarksActionsTypes.SaveCodemarks, codemarks);

export const updateCodemarks = (codemarks: CSCodemark[]) =>
	action(CodemarksActionsTypes.UpdateCodemarks, codemarks);

export interface BaseNewCodemarkAttributes {
	codeBlocks: GetRangeScmInfoResponse[];
	text: string;
	type: CodemarkType;
	assignees: string[];
	title?: string;
	crossPostIssueValues?: CrossPostIssueValues;
	tags: string[];
	relatedCodemarkIds: string[];
}

export interface SharingNewCodemarkAttributes extends BaseNewCodemarkAttributes {
	accessMemberIds: string[];
	remotes?: string[];
}

export interface LegacyNewCodemarkAttributes extends BaseNewCodemarkAttributes {
	streamId: string;
}

export type NewCodemarkAttributes = LegacyNewCodemarkAttributes | SharingNewCodemarkAttributes;

export function isLegacyNewCodemarkAttributes(
	object: NewCodemarkAttributes
): object is LegacyNewCodemarkAttributes {
	return (object as any).streamId != undefined;
}

export const createCodemark = (attributes: SharingNewCodemarkAttributes) => async dispatch => {
	const { accessMemberIds, ...rest } = attributes;

	try {
		const response = await HostApi.instance.send(CreateShareableCodemarkRequestType, {
			attributes: rest,
			memberIds: accessMemberIds
		});
		if (response) {
			dispatch(addCodemarks([response.codemark]));
			dispatch(addStreams([response.stream]));

			try {
				const response2 = await HostApi.instance.send(CreateThirdPartyPostRequestType, {
					//TODO cheese
					providerId:  "slack*com",
					text: rest.text,
					codemark: response.codemark,
					remotes: attributes.remotes,
					markerLocations: response.markerLocations,
					//TODO cheese
					channelId: "CJ7PH1NDP",
					memberIds: accessMemberIds
				});
			} catch (error) {
				logError("Error sharing a codemark in the sharing model", { message: error.message });
			}
		}
	} catch (error) {
		logError("Error creating a codemark in the sharing model", { message: error.message });
		throw error;
	}
};

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
