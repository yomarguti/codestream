import { MiddlewareAPI } from "redux";
import { CodeStreamState } from "..";
import { Dispatch } from "../common";
import { BootstrapActionType } from "../bootstrapped/types";
import { setFeatureFlag } from "./actions";
import { getTeamProvider } from "../teams/reducer";

export const featureFlagsMiddleware = (
	store: MiddlewareAPI<Dispatch, CodeStreamState>
) => next => (action: { type: string }) => {
	if (action.type === BootstrapActionType.Complete) {
		const { teams, context, session } = store.getState();
		if (session.userId) {
			const isCodeStreamTeam = getTeamProvider(teams[context.currentTeamId]) === "codestream";

			store.dispatch(setFeatureFlag("sharing", isCodeStreamTeam));
		}
	}
	return next(action);
};
