import { action } from "../common";
import { ConfigsActionsType, ConfigsState } from "./types";
import * as url from "url";

export const updateConfigs = (configs: Partial<ConfigsState>) =>
	action(ConfigsActionsType.Update, configs);

export const supportsIntegrations = (configs: Partial<ConfigsState>) => {
	if (!configs.serverUrl || url.parse(configs.serverUrl).protocol === "https:") {
		return true;
	} else {
		return false;
	}
};

export const isOnPrem = serverUrl => {
	const match = serverUrl.match(/^https?:\/\/(.+)\.codestream\.(us|com)/);
	return !match || match[1] === "oppr" || match[1] === "opbeta";
};
