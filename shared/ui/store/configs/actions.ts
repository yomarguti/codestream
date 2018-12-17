import { action } from "../common";
import { ConfigsActionsType, State } from "./types";

export const updateConfigs = (configs: Partial<State>) =>
	action(ConfigsActionsType.Update, configs);
