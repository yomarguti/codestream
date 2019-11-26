export type ActivityFeedState = ActivityFeedActivity[];

export type ActivityFeedActivity = string;

export enum ActivityFeedActionType {
	AddOlder = "@activityFeed/AddOlderActivity",
	AddNew = "@activityFeed/AddNewActivity"
}
