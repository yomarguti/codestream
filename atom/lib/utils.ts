import * as path from "path";

export const accessSafely = <T>(f: () => T): T | void => {
	try {
		return f();
	} catch (e) {
		return undefined;
	}
};

export const asAbsolutePath = (relativePath: string) => {
	const p = atom.packages.getLoadedPackage("CodeStream");
	return path.resolve(p!.path, relativePath);
};

export const getPluginVersion = () => {
	const p = atom.packages.getLoadedPackage("CodeStream");
	return p!.metadata.version;
};
