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
import { addStreams } from "../streams/actions";
import { TextDocumentIdentifier } from "vscode-languageserver-types";

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
	sharingAttributes?: {
		providerId: string;
		providerTeamId: string;
		channelId: string;
	};
	textDocuments?: TextDocumentIdentifier[];
	entryPoint?: string;
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

export interface CreateCodemarkError {
	reason: "share" | "create";
}

export const createCodemark = (attributes: SharingNewCodemarkAttributes) => async dispatch => {
	const { accessMemberIds, ...rest } = attributes;

	try {
		const response = await HostApi.instance.send(CreateShareableCodemarkRequestType, {
			attributes: rest,
			memberIds: accessMemberIds,
			textDocuments: attributes.textDocuments,
			entryPoint: attributes.entryPoint
		});
		if (response) {
			dispatch(addCodemarks([response.codemark]));
			dispatch(addStreams([response.stream]));

			if (attributes.sharingAttributes) {
				try {
					await HostApi.instance.send(CreateThirdPartyPostRequestType, {
						providerId: attributes.sharingAttributes.providerId,
						channelId: attributes.sharingAttributes.channelId,
						providerTeamId: attributes.sharingAttributes.providerTeamId,
						text: rest.text,
						codemark: response.codemark,
						remotes: attributes.remotes,
						markerLocations: response.markerLocations
					});
				} catch (error) {
					logError("Error sharing a codemark in the sharing model", { message: error.message });
					// TODO: communicate failure to users
					throw { reason: "share" } as CreateCodemarkError;
				}
			}
		}
	} catch (error) {
		logError("Error creating a codemark in the sharing model", { message: error.message });
		throw { reason: "create" } as CreateCodemarkError;
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
