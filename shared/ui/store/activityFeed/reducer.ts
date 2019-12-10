import { CodemarksState } from "../codemarks/types";
import { ActivityFeedState, ActivityFeedActionType, ActivityFeedActivity } from "./types";
import { CodeStreamState } from "..";
import { createSelector } from "reselect";
import { mapFilter } from "@codestream/webview/utils";
import * as actions from "./actions";
import { ActionType } from "../common";
import { uniq } from "lodash-es";
import { PostsState } from "../posts/types";
import { getPost } from "../posts/reducer";

type ActivityFeedAction = ActionType<typeof actions>;

const initialState: ActivityFeedState = {
	records: [],
	hasMore: true /* assume yes to start, as history is fetched, we'll know when there's no more  */
};

export function reduceActivityFeed(state = initialState, action: ActivityFeedAction) {
	switch (action.type) {
		case ActivityFeedActionType.AddOlder: {
			return {
				hasMore: action.payload.hasMore,
				records: uniq([...state.records, ...action.payload.activities])
			};
		}
		case ActivityFeedActionType.AddNew: {
			return { ...state, records: uniq([...action.payload, ...state.records]) };
		}
		case "RESET": {
			return initialState;
		}
		default:
			return state;
	}
}

export const getActivity = createSelector(
	(state: CodeStreamState) => state.codemarks,
	(state: CodeStreamState) => state.activityFeed.records,
	(state: CodeStreamState) => state.posts,
	(codemarks: CodemarksState, activityFeed: ActivityFeedActivity[], posts: PostsState) => {
		return mapFilter(activityFeed, activity => {
			const [model, id] = activity.split("|");
			switch (model) {
				case "codemark":
					const codemark = codemarks[id];
					return { ...codemark, post: getPost(posts, codemark.streamId, codemark.postId) };
				default:
					return;
			}
		});
	}
);
