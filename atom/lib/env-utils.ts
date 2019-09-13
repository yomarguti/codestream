export enum Environment {
	Production = "Production",
	PD = "PD",
	QA = "QA",
	Unknown = "Unknown",
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

export function getEnvConfigForServerUrl(url?: string): EnvironmentConfig {
	if (!url) return PRODUCTION_CONFIG;

	const matchedConfig = [PRODUCTION_CONFIG, PD_CONFIG, QA_CONFIG].find(
		config => config.serverUrl === url
	);

	return matchedConfig || { name: Environment.Unknown, serverUrl: url };
}

export function normalizeServerUrl(url: string) {
	if (url.endsWith("/")) return normalizeServerUrl(url.substring(0, url.length - 1));

	return url;
}
