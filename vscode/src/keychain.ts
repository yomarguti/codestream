import * as vscode from "vscode";

// Copied from https://github.com/Microsoft/vscode-pull-request-github/blob/master/src/common/keychain.ts

// keytar depends on a native module shipped in vscode, so this is
// how we load it
import * as keytarType from "keytar";

function getNodeModule<T>(moduleName: string): T | undefined {
	// tslint:disable-next-line:no-eval
	const vscodeRequire = eval("require");
	try {
		return vscodeRequire(`${vscode.env.appRoot}/node_modules.asar/${moduleName}`);
	} catch (ex) {
		// Not in ASAR.
	}
	try {
		return vscodeRequire(`${vscode.env.appRoot}/node_modules/${moduleName}`);
	} catch (ex) {
		// Not available.
	}
	return undefined;
}

export const keychain = getNodeModule<typeof keytarType>("keytar");
