export interface Stream {
	id: string;
	teamId: string;
	isTeamStream?: boolean;
	type: string;
	name: string;
	deactivated: boolean;
	privacy: "public" | "private";
	purpose?: string;
	isArchived?: boolean;
	serviceType?: string;
	memberIds?: string[];
	displayName?: string; // TOOO: remove
}

export enum StreamActionType {
	ADD_STREAMS = "ADD_STREAMS",
	BOOTSTRAP_STREAMS = "BOOTSTRAP_STREAMS",
	UPDATE_STREAM = "UPDATE_STREAM",
	REMOVE_STREAM = "REMOVE_STREAM"
}
