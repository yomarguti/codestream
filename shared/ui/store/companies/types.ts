import { CSCompany } from "@codestream/protocols/api";

export interface CompaniesState {
	[id: string]: CSCompany;
}

export enum CompaniesActionsType {
	Bootstrap = "@companies/Bootstrap",
	Add = "ADD_TEAMS", // legacy - required for handling pubnub updates
	Update = "@companies/Update"
}
