import { action } from "../common";
import { UnreadsState, UnreadsActionsType } from "./types";

export const reset = () => action("RESET");

export const updateUnreads = (data: UnreadsState) => action(UnreadsActionsType.Update, data);
