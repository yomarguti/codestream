import {
	CSTeam,
	CSReviewApprovalSetting,
	CSReviewAssignmentSetting
} from "@codestream/protocols/api";
import { toMapBy } from "../../utils";
import { ActionType } from "../common";
import * as actions from "./actions";
import { TeamsState, TeamsActionsType } from "./types";
import { CodeStreamState } from "..";

type TeamsActions = ActionType<typeof actions>;

const initialState: TeamsState = {};

const updateTeam = (payload: CSTeam, teams: TeamsState) => {
	const team = teams[payload.id] || {};
	return { ...team, ...payload };
};

export function reduceTeams(state = initialState, action: TeamsActions) {
	switch (action.type) {
		case TeamsActionsType.Bootstrap:
			return toMapBy("id", action.payload);
		case TeamsActionsType.Update:
			return { ...state, [action.payload.id]: updateTeam(action.payload, state) };
		case TeamsActionsType.Add:
			return { ...state, ...toMapBy("id", action.payload) };
		case "RESET":
			return initialState;
		default:
			return state;
	}
}

export function getCurrentTeamProvider(state: CodeStreamState) {
	return getTeamProvider(state.teams[state.context.currentTeamId]);
}

export function getTeamProvider(team: CSTeam): "codestream" | "slack" | "msteams" | string {
	if (team.providerInfo == null || Object.keys(team.providerInfo).length === 0) {
		return "codestream";
	}

	return Object.keys(team.providerInfo)[0];
}

// return a team setting if it's set, otherwise return the default value
export function getTeamSetting(team: CSTeam, setting: string) {
	const { settings = {} } = team;
	const DEFAULTS = {
		reviewApproval: CSReviewApprovalSetting.User,
		reviewAssignment: CSReviewAssignmentSetting.Authorship2
	};
	return settings[setting] != undefined ? settings[setting] : DEFAULTS[setting];
}
