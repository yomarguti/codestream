import { CSEntity } from "@codestream/protocols/api";
import { action } from "../common";
import { ActivityFeedActionType } from "./types";
import { sortBy } from "lodash-es";
import { CodemarkPlus } from "@codestream/protocols/agent";

export const addOlderActivity = (model: string, activities: CSEntity[]) => {
	return action(
		ActivityFeedActionType.AddOlder,
		activities.map(a => `${model}|${a.id}`)
	);
};

export const addNewActivity = (model: string, activities: CSEntity[]) => {
	let sortedActivities = [...activities];
	switch (model) {
		case "codemark":
			sortedActivities = sortBy(sortedActivities as CodemarkPlus[], c => -c.lastActivityAt);
			break;
		default:
			break;
	}

	return action(
		ActivityFeedActionType.AddNew,
		sortedActivities.map(a => `${model}|${a.id}`)
	);
};
