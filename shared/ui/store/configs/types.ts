import { WebviewConfigs } from "@codestream/protocols/webview";

export interface State extends WebviewConfigs {}

export enum ConfigsActionsType {
	Update = "UPDATE_CONFIGS"
}
