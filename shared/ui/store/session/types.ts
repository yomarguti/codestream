export interface SessionState {
	userId?: string;
	otc?: string;
}

export enum SessionActionType {
	Set = "SET_SESSION"
}
