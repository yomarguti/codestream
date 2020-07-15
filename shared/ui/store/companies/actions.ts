import { CSCompany } from "@codestream/protocols/api";
import { action } from "../common";
import { CompaniesActionsType } from "./types";

export const reset = () => action("RESET");

export const bootstrapCompanies = (companies: CSCompany[]) =>
	action(CompaniesActionsType.Bootstrap, companies);

export const addCompanies = (companies: CSCompany[]) => action(CompaniesActionsType.Add, companies);

export const updateCompany = (company: CSCompany) => action(CompaniesActionsType.Update, company);
