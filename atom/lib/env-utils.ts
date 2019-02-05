export enum Environment {
	Production,
	PD,
}

export interface EnvironmentConfig {
	webAppUrl: string;
	serverUrl: string;
}

export const PRODUCTION_CONFIG: EnvironmentConfig = {
	webAppUrl: "https://app.codestream.com",
	serverUrl: "https://api.codestream.com",
};

export const PD_CONFIG: EnvironmentConfig = {
	serverUrl: "https://pd-api.codestream.us:9443",
	webAppUrl: "http://pd-app.codestream.us:1380",
};
