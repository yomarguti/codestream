export interface State {
	lastReads: {};
	mentions: {};
	unreads: {};
	totalUnreads: number;
	totalMentions: number;
}

export enum UnreadsActionsType {
	Update = "UPDATE_UNREADS"
}
