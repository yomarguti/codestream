export interface State {
	showHeadshots: boolean;
	debug: boolean;
	email?: string;
	serverUrl: string;
}

export enum ConfigsActionsType {
	Update = "UPDATE_CONFIGS"
}
