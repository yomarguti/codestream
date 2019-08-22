export interface ApiVersioningState {
	type: ApiVersioningActionsType;
}

export enum ApiVersioningActionsType {
	ApiOk = "ApiOk",
	ApiUpgradeRecommended = "ApiUpgradeRecommended",
	ApiUpgradeRequired = "ApiUpgradeRequired"
}
