import { CSUser } from "@codestream/protocols/api";

export interface State {
	[id: string]: CSUser;
}

export enum UsersActionsType {
	Bootstrap = "BOOTSTRAP_USERS",
	Update = "UPDATE_USER",
	Add = "ADD_USERS"
}
