import { CSTeam } from "../../shared/api.protocol";
import { action } from "../common";
import { TeamsActionsType } from "./types";

export const bootstrapTeams = (teams: CSTeam[]) => action(TeamsActionsType.Bootstrap, teams);

export const addTeams = (teams: CSTeam[]) => action(TeamsActionsType.Add, teams);
