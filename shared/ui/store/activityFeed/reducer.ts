import { CodemarksState } from "../codemarks/types";
import { ActivityFeedState, ActivityFeedActionType } from "./types";
import { CodeStreamState } from "..";
import { createSelector } from "reselect";
import { mapFilter } from "@codestream/webview/utils";
import * as actions from "./actions";
import { ActionType } from "../common";

type ActivityFeedAction = ActionType<typeof actions>;

const initialState: ActivityFeedState = [];

export function reduceActivityFeed(state = initialState, action: ActivityFeedAction) {
	switch (action.type) {
		case ActivityFeedActionType.Save: {
			return [...action.payload, ...state];
		}
		default:
			return state;
	}
}

export const getActivity = createSelector(
	(state: CodeStreamState) => state.codemarks,
	(state: CodeStreamState) => state.activityFeed,
	(codemarks: CodemarksState, activityFeed: ActivityFeedState) => {
		return mapFilter(activityFeed, activity => {
			const [model, id] = activity.split("|");
			switch (model) {
				case "codemark":
					return codemarks[id];
				default:
					return;
			}
		});
	}
);
