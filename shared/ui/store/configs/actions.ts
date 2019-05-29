import { action } from "../common";
import { ConfigsActionsType, ConfigsState } from "./types";

export const updateConfigs = (configs: Partial<ConfigsState>) =>
	action(ConfigsActionsType.Update, configs);
