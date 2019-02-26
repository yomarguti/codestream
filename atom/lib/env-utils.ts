export enum Environment {
	Production = "Production",
	PD = "PD",
}

export interface EnvironmentConfig {
	webAppUrl: string;
	serverUrl: string;
	name: Environment;
}

export const PRODUCTION_CONFIG: EnvironmentConfig = {
	name: Environment.Production,
	webAppUrl: "https://app.codestream.com",
	serverUrl: "https://api.codestream.com",
};

export const PD_CONFIG: EnvironmentConfig = {
	name: Environment.PD,
	serverUrl: "https://pd-api.codestream.us:9443",
	webAppUrl: "http://pd-app.codestream.us:1380",
};
