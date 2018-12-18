import { CSRepository } from "../../shared/api.protocol";

export interface State {
	[id: string]: CSRepository;
}

export enum ReposActionsType {
	Bootstrap = "BOOTSTRAP_REPOS",
	Add = "ADD_REPOS"
}
