export const PRODUCTION = "production";

export const getEnv = () => {
	return sessionStorage.getItem("codestream.env") || PRODUCTION;
};
