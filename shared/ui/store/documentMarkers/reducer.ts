import { DocumentMarkersState, DocumentMarkersActionsType } from "./types";
import * as actions from "./actions";
import { ActionType } from "../common";
import { uniqBy } from "lodash-es";

type DocumentMarkersAction = ActionType<typeof actions>;

const initialState: DocumentMarkersState = {};

export function reduceDocumentMarkers(state = initialState, action: DocumentMarkersAction) {
	switch (action.type) {
		case DocumentMarkersActionsType.SaveForFile: {
			return { ...state, [action.payload.uri]: action.payload.markers };
		}
		case DocumentMarkersActionsType.SaveOneForFile: {
			return {
				...state,
				[action.payload.uri]: uniqBy(
					[...state[action.payload.uri], action.payload.marker],
					m => m.id
				)
			};
		}
		case "RESET": {
			return initialState;
		}
		default:
			return state;
	}
}
