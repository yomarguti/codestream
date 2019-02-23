import { CSTeam } from "@codestream/protocols/api";
import { action } from "../common";
import { TeamsActionsType } from "./types";

export const reset = () => action("RESET");

export const bootstrapTeams = (teams: CSTeam[]) => action(TeamsActionsType.Bootstrap, teams);

export const addTeams = (teams: CSTeam[]) => action(TeamsActionsType.Add, teams);
