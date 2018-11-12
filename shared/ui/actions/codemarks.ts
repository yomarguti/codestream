import { ActionCreator, Action } from "redux";

interface CodemarksAction extends Action {
	payload: object[];
}

export enum Type {
	SAVE_CODEMARKS = "SAVE_CODEMARKS",
	UPDATE_CODEMARKS = "UPDATE_CODEMARKS"
}

export const saveCodemarks: ActionCreator<CodemarksAction> = codemarks => ({
	type: Type.SAVE_CODEMARKS,
	payload: codemarks
});

export const updateCodemarks: ActionCreator<CodemarksAction> = codemarks => ({
	type: Type.UPDATE_CODEMARKS,
	payload: codemarks
});
