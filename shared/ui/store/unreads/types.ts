import { Unreads } from "@codestream/protocols/agent";

export interface State extends Unreads {}

export enum UnreadsActionsType {
	Update = "UPDATE_UNREADS"
}
