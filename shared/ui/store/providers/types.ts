import { ThirdPartyProviders } from "@codestream/protocols/agent";

export interface State {
	providers?: ThirdPartyProviders;
}

export enum ProvidersActionsType {
	Update = "UPDATE_PROVIDERS"
}

