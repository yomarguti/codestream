import { CSTeam } from "../../shared/api.protocol";

export interface State {
	[id: string]: CSTeam;
}

export enum TeamsActionsType {
	Bootstrap = "BOOTSTRAP_TEAMS",
	Add = "ADD_TEAMS"
}
