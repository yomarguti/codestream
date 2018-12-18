import { action } from "../common";
import { ConnectivityActionsType } from "./types";

export const offline = () => action(ConnectivityActionsType.Offline);
export const online = () => action(ConnectivityActionsType.Online);
