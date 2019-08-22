import { ApiVersioningActionsType, ApiVersioningState } from "./types";

const initialState: ApiVersioningState = {
	type: ApiVersioningActionsType.ApiOk
};

export function reduceApiVersioning(state = initialState, { type }: ApiVersioningState) {
	switch (type) {
		case ApiVersioningActionsType.ApiUpgradeRequired:
			return { ...state, type: ApiVersioningActionsType.ApiUpgradeRequired };
		case ApiVersioningActionsType.ApiUpgradeRecommended:
			return { ...state, type: ApiVersioningActionsType.ApiUpgradeRecommended };
		case ApiVersioningActionsType.ApiOk:
			return { ...state, type: ApiVersioningActionsType.ApiOk };
		default:
			return state;
	}
}
