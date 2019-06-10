export enum Environment {
	Production = "Production",
	PD = "PD",
	QA = "QA",
}

export interface EnvironmentConfig {
	serverUrl: string;
	name: Environment;
}

export const PRODUCTION_CONFIG: EnvironmentConfig = {
	name: Environment.Production,
	serverUrl: "https://api.codestream.com",
};

export const PD_CONFIG: EnvironmentConfig = {
	name: Environment.PD,
	serverUrl: "https://pd-api.codestream.us:9443",
};

export const QA_CONFIG: EnvironmentConfig = {
	name: Environment.QA,
	serverUrl: "https://qa-api.codestream.us",
};
