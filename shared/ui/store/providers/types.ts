import { ThirdPartyProviders } from "@codestream/protocols/agent";

export interface ProvidersState {
	providers?: ThirdPartyProviders;
}

export enum ProvidersActionsType {
	Update = "UPDATE_PROVIDERS"
}
