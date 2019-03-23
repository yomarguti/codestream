import { ThirdPartyProviderInstance } from "@codestream/protocols/agent";

export interface State {
	providers?: ThirdPartyProviderInstance[];
}

export enum ProvidersActionsType {
	Update = "UPDATE_PROVIDERS"
}

