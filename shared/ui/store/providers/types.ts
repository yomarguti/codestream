import { ThirdPartyProviderInstance } from "@codestream/protocols/agent";

export interface State {
	issueProviders?: ThirdPartyProviderInstance[];
}

export enum ProvidersActionsType {
	Update = "UPDATE_PROVIDERS"
}

