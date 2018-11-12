import { ActionCreator, Action } from "redux";

interface SaveCodemarksAction extends Action {
	payload: object[];
}

export enum Type {
	SAVE_CODEMARKS = "SAVE_CODEMARKS"
}

export const saveCodemarks: ActionCreator<SaveCodemarksAction> = codemarks => ({
	type: Type.SAVE_CODEMARKS,
	payload: codemarks
});
