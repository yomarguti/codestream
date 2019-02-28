import * as path from "path";

export const accessSafely = <T>(f: () => T): T | void => {
	try {
		return f();
	} catch (e) {
		return undefined;
	}
};

function getPackage() {
	return atom.packages.getLoadedPackage("codestream")!;
}

export const asAbsolutePath = (relativePath: string) => {
	return path.resolve(getPackage().path, relativePath);
};

export const getPluginVersion = () => {
	return (getPackage() as any).metadata.version;
};

export const getDevPath = () => {
	const distPath = path.dirname((getPackage() as any).mainModulePath);
	return path.resolve(distPath, "..");
};

export const getAgentSource = () => {
	return path.resolve(getDevPath(), "../codestream-lsp-agent/dist/agent.js");
};
