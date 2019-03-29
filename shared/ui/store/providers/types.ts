import { ThirdPartyProviderConfig } from "@codestream/protocols/agent";

export interface State {
	providers?: ThirdPartyProviderConfig[];
}

export enum ProvidersActionsType {
	Update = "UPDATE_PROVIDERS"
}

