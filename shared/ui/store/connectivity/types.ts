export interface ConnectivityState {
	offline: boolean;
}

export enum ConnectivityActionsType {
	Online = "ONLINE",
	Offline = "OFFLINE"
}
