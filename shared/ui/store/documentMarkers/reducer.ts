import { State, DocumentMarkersActionsType } from "./types";
import * as actions from "./actions";
import { ActionType } from "../common";

type DocumentMarkersAction = ActionType<typeof actions>;

const initialState: State = {};

export function reduceDocumentMarkers(state = initialState, action: DocumentMarkersAction) {
	switch (action.type) {
		case DocumentMarkersActionsType.SaveForFile: {
			return { ...state, [action.payload.uri]: action.payload.markers };
		}
		case "RESET": {
			return initialState;
		}
		default:
			return state;
	}
}
