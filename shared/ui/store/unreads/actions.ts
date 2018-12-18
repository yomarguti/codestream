import { action } from "../common";
import { State, UnreadsActionsType } from "./types";

export const updateUnreads = (data: State) => action(UnreadsActionsType.Update, data);
