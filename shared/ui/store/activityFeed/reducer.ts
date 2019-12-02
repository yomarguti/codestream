import { CodemarksState } from "../codemarks/types";
import { ActivityFeedState, ActivityFeedActionType, ActivityFeedActivity } from "./types";
import { CodeStreamState } from "..";
import { createSelector } from "reselect";
import { mapFilter } from "@codestream/webview/utils";
import * as actions from "./actions";
import { ActionType } from "../common";
import { uniq } from "lodash-es";

type ActivityFeedAction = ActionType<typeof actions>;

const initialState: ActivityFeedState = { records: [], hasMore: false };

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
		default:
			return state;
	}
}

export const getActivity = createSelector(
	(state: CodeStreamState) => state.codemarks,
	(state: CodeStreamState) => state.activityFeed.records,
	(codemarks: CodemarksState, activityFeed: ActivityFeedActivity[]) => {
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
