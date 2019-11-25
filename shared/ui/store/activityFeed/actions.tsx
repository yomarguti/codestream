import { CSEntity } from "@codestream/protocols/api";
import { action } from "../common";
import { ActivityFeedActionType } from "./types";

export const saveActivity = (model: string, activities: CSEntity[]) => {
	return action(
		ActivityFeedActionType.Save,
		activities.map(a => `${model}|${a.id}`)
	);
};
