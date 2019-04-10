import { CodemarkPlus } from "@codestream/protocols/agent";

export enum CodemarksActionsTypes {
	AddCodemarks = "ADD_CODEMARKS",
	SaveCodemarks = "SAVE_CODEMARKS",
	UpdateCodemarks = "UPDATE_CODEMARKS"
}

export interface State {
	[codemarkId: string]: CodemarkPlus;
}
