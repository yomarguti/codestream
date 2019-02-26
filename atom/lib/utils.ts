import * as path from "path";

export const accessSafely = <T>(f: () => T): T | void => {
	try {
		return f();
	} catch (e) {
		return undefined;
	}
};

export const asAbsolutePath = (relativePath: string) => {
	const p = atom.packages.getLoadedPackage("codestream");
	return path.resolve(p!.path, relativePath);
};

export const getPluginVersion = () => {
	const p = atom.packages.getLoadedPackage("codestream");
	return (p as any)!.metadata.version;
};
