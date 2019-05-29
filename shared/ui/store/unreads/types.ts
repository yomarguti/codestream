import { Unreads } from "@codestream/protocols/agent";

export interface UnreadsState extends Unreads {}

export enum UnreadsActionsType {
	Update = "UPDATE_UNREADS"
}
