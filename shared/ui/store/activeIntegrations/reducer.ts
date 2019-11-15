import {
	ActiveIntegrationsState,
	ActiveIntegrationsActionType,
	ActiveIntegrationData
} from "./types";
import { emptyArray, emptyObject } from "@codestream/webview/utils";
import * as actions from "./actions";
import { ActionType } from "../common";

type ActiveIntegrationsAction = ActionType<typeof actions>;

const initialState: ActiveIntegrationsState = {};

export function reduceActiveIntegrations(state = initialState, action: ActiveIntegrationsAction) {
	switch (action.type) {
		case ActiveIntegrationsActionType.UpdateForProvider: {
			const nextState = { ...state[action.payload.providerId], ...action.payload.data };

			return {
				...state,
				[action.payload.providerId]: nextState
			};
		}
		case ActiveIntegrationsActionType.DeleteForProvider: {
			const nextState = { ...state };
			delete nextState[action.payload.providerId];
			return nextState;
		}
		case "RESET": {
			return initialState;
		}
		default:
			return state;
	}
}

export function getIntegrationData<T extends ActiveIntegrationData>(
	state: ActiveIntegrationsState,
	providerId: string
): T {
	return (state[providerId] || emptyObject) as T;
}

export const getBoards = (state: ActiveIntegrationsState, providerId?: string) => {
	if (providerId == undefined) return emptyArray;
	const data = state[providerId];
	if (!data) return emptyArray;
	return (data as any).boards;
};
