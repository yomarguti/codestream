import { action } from "../common";
import { State, ProvidersActionsType } from "./types";

export const reset = () => action("RESET");

export const updateProviders = (data: State) => action(ProvidersActionsType.Update, data);
