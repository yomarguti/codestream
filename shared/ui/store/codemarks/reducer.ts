import { CSCodemark } from "@codestream/protocols/api";
import { createSelector } from "reselect";
import { toMapBy } from "../../utils";
import { ActionType } from "../common";
import * as actions from "./actions";
import { CodemarksActionsTypes } from "./types";

type CodemarksActions = ActionType<typeof actions>;

interface State {
	[codemarkId: string]: CSCodemark;
}

const initialState: State = {};

export function reduceCodemarks(state = initialState, action: CodemarksActions) {
	switch (action.type) {
		case CodemarksActionsTypes.AddCodemarks:
		case CodemarksActionsTypes.UpdateCodemarks:
		case CodemarksActionsTypes.SaveCodemarks: {
			return { ...state, ...toMapBy("id", action.payload) };
		}
		case "RESET":
			return initialState;
		default:
			return state;
	}
}

export function getCodemark(state: State, id?: string): CSCodemark | undefined {
	if (!id) return undefined;
	return state[id];
}

export function getByType(state: State, type?: string): CSCodemark[] {
	if (!type) return Object.values(state);

	return Object.values(state).filter(codemark => codemark.type === type);
}

const getCodemarks = state => state.codemarks;
const getCodemarkTypeFilter = state => state.context.codemarkTypeFilter;
export const getTypeFilteredCodemarks = createSelector(
	getCodemarks,
	getCodemarkTypeFilter,
	(codemarks: State, filter: string) => {
		if (filter === "all") return Object.values(codemarks);
		else {
			return Object.values(codemarks).filter(
				codemark => codemark.type === filter && !codemark.deactivated
			);
		}
	}
);
const getCodemarkFileFilter = state => {
	const { context } = state;
	// let fileNameToFilterFor;
	let fileStreamIdToFilterFor;
	if (context.activeFile && context.fileStreamId) {
		// fileNameToFilterFor = context.activeFile;
		fileStreamIdToFilterFor = context.fileStreamId;
	} else if (context.activeFile && !context.fileStreamId) {
		// fileNameToFilterFor = context.activeFile;
	} else {
		// fileNameToFilterFor = context.lastActiveFile;
		fileStreamIdToFilterFor = context.lastFileStreamId;
	}
	return fileStreamIdToFilterFor;
};
export const getFileFilteredCodemarks = createSelector(
	getCodemarks,
	getCodemarkFileFilter,
	(codemarks: State, filter: string) => {
		return Object.values(codemarks).filter(codemark => {
			const codeBlock = codemark.markers && codemark.markers.length && codemark.markers[0];
			const codeBlockFileStreamId = codeBlock && codeBlock.fileStreamId;
			return !codemark.deactivated && codeBlockFileStreamId === filter;
		});
	}
);

export const teamHasCodemarks = createSelector(
	getCodemarks,
	(codemarks: State) => {
		return Object.keys(codemarks).length > 0;
	}
);
