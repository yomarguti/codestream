import { CSCompany } from "@codestream/protocols/api";
import { action } from "../common";
import { CompaniesActionsType } from "./types";

export const reset = () => action("RESET");

export const bootstrapCompanies = (companies: CSCompany[]) =>
	action(CompaniesActionsType.Bootstrap, companies);

export const addCompanies = (teams: CSCompany[]) => action(CompaniesActionsType.Add, teams);

export const updateCompany = (team: CSCompany) => action(CompaniesActionsType.Update, team);
