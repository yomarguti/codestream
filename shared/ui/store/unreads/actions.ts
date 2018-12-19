import { action } from "../common";
import { State, UnreadsActionsType } from "./types";

export { reset } from "../../actions";

export const updateUnreads = (data: State) => action(UnreadsActionsType.Update, data);
