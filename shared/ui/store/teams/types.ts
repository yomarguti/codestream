import { CSTeam } from "@codestream/protocols/api";

export interface State {
	[id: string]: CSTeam;
}

export enum TeamsActionsType {
	Bootstrap = "BOOTSTRAP_TEAMS",
	Add = "ADD_TEAMS"
}
