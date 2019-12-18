import { action } from "../common";
import { ConnectivityActionsType } from "./types";

export const reset = () => action("RESET");

export const offline = () => action(ConnectivityActionsType.Offline);
export const online = () => action(ConnectivityActionsType.Online);
export const errorOccurred = (message: string, details?: string) => action(ConnectivityActionsType.ErrorOccurred, { message, details });
export const errorDismissed = () => action(ConnectivityActionsType.ErrorDismissed);
