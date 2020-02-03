import { CSReview } from "@codestream/protocols/api";
import { action } from "../common";
import { ReviewsActionsTypes } from "./types";
import { HostApi } from "@codestream/webview/webview-api";
import {
	UpdateReviewRequestType,
	DeleteReviewRequestType,
	CrossPostIssueValues,
	CreateReviewRequestType,
	CreateThirdPartyPostRequestType,
	CreateShareableReviewRequestType,
	RepoScmStatus
} from "@codestream/protocols/agent";
import { logError } from "@codestream/webview/logger";
import { addStreams } from "../streams/actions";
import { TextDocumentIdentifier } from "vscode-languageserver-types";
import { getConnectedProviders } from "../providers/reducer";
import { CodeStreamState } from "..";
import { capitalize } from "@codestream/webview/utils";
import { addPosts } from "../posts/actions";

export const reset = () => action("RESET");

export const addReviews = (reviews: CSReview[]) => action(ReviewsActionsTypes.AddReviews, reviews);

export const saveReviews = (reviews: CSReview[]) =>
	action(ReviewsActionsTypes.SaveReviews, reviews);

export const updateReviews = (reviews: CSReview[]) =>
	action(ReviewsActionsTypes.UpdateReviews, reviews);

export interface NewReviewAttributes {
	title: string;
	text: string;
	reviewers: string[];
	tags: string[];

	// these changes will be massaged into a changeSet
	repoChanges: {
		scm: RepoScmStatus;
		startCommit: string;
		excludeCommit: string;
		excludedFiles: string[];
		includeSaved: boolean;
		includeStaged: boolean;
		remotes: { name: string; url: string }[];
	}[];

	accessMemberIds: string[];
	sharingAttributes?: {
		providerId: string;
		providerTeamId: string;
		channelId: string;
	};
	mentionedUserIds?: string[];
}

export interface CreateReviewError {
	reason: "share" | "create";
}

export const createReview = (attributes: NewReviewAttributes) => async (
	dispatch,
	getState: () => CodeStreamState
) => {
	const { accessMemberIds, ...rest } = attributes;

	try {
		const response = await HostApi.instance.send(CreateShareableReviewRequestType, {
			attributes: rest,
			memberIds: accessMemberIds,
			mentionedUserIds: attributes.mentionedUserIds
		});
		if (response) {
			const result = dispatch(addReviews([response.review]));
			dispatch(addStreams([response.stream]));
			dispatch(addPosts([response.post]));

			if (attributes.sharingAttributes) {
				try {
					await HostApi.instance.send(CreateThirdPartyPostRequestType, {
						providerId: attributes.sharingAttributes.providerId,
						channelId: attributes.sharingAttributes.channelId,
						providerTeamId: attributes.sharingAttributes.providerTeamId,
						text: rest.text,
						review: response.review,
						mentionedUserIds: attributes.mentionedUserIds
					});
					HostApi.instance.track("Shared Review", {
						Destination: capitalize(
							getConnectedProviders(getState()).find(
								config => config.id === attributes.sharingAttributes!.providerId
							)!.name
						),
						"Review Status": "New"
					});
				} catch (error) {
					logError("Error sharing a review", { message: error.message });
					// TODO: communicate failure to users
					throw { reason: "share" } as CreateReviewError;
				}
			}
			return result;
		}
	} catch (error) {
		logError("Error creating a review", { message: error.message });
		throw { reason: "create" } as CreateReviewError;
	}
};

export const _deleteReview = (id: string) => action(ReviewsActionsTypes.Delete, id);

export const deleteReview = (id: string) => async dispatch => {
	try {
		void (await HostApi.instance.send(DeleteReviewRequestType, {
			id
		}));
		dispatch(_deleteReview(id));
	} catch (error) {
		logError(`failed to delete review: ${error}`, { id });
	}
};

type EditableAttributes = Partial<Pick<CSReview, "tags" | "text" | "title" | "reviewers">>;

export const editReview = (id: string, attributes: EditableAttributes) => async dispatch => {
	try {
		const response = await HostApi.instance.send(UpdateReviewRequestType, {
			id,
			...attributes
		});
		dispatch(updateReviews([response.review]));
	} catch (error) {
		logError(`failed to update review: ${error}`, { id });
	}
};
