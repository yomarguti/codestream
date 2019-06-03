import { CSTeam } from "@codestream/protocols/api";
import { action } from "../common";
import { TeamsActionsType } from "./types";
import { CodeStreamState } from "../index";

export const reset = () => action("RESET");

export const bootstrapTeams = (teams: CSTeam[]) => action(TeamsActionsType.Bootstrap, teams);

export const addTeams = (teams: CSTeam[]) => action(TeamsActionsType.Add, teams);

export function getCurrentTeamProvider(state: CodeStreamState) {
	return getTeamProvider(state.teams[state.context.currentTeamId]);
}

export function getTeamProvider(team: CSTeam): "codestream" | "slack" | "msteams" | string {
	if (team.providerInfo == null || Object.keys(team.providerInfo).length === 0) {
		return "codestream";
	}

	return Object.keys(team.providerInfo)[0];
}
