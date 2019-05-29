import { action } from "../common";
import { ProvidersState, ProvidersActionsType } from "./types";

export const reset = () => action("RESET");

export const updateProviders = (data: ProvidersState) => action(ProvidersActionsType.Update, data);
