import { TextEditor } from "atom";
import { Convert } from "atom-languageclient";
import * as path from "path";
import { Range } from "vscode-languageserver-types";

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

export namespace Editor {
	function getActiveFilePath() {
		const editor = atom.workspace.getActiveTextEditor();
		return editor && editor.getPath();
	}

	export function getActiveFile() {
		const filePath = getActiveFilePath();
		if (filePath) return atom.project.relativize(filePath);
		return undefined;
	}

	export function getActiveFileUri() {
		const filePath = getActiveFilePath();
		if (filePath !== undefined) return Convert.pathToUri(filePath);
		return undefined;
	}

	export function getUri(editor: TextEditor) {
		return Convert.pathToUri(editor.getPath() || "");
	}

	export function getSelection(editor: TextEditor) {
		const selection = editor.getSelectedBufferRange();
		const range = Convert.atomRangeToLSRange(selection);
		if (range.start.line === range.end.line && range.start.character === range.end.character) {
			return Range.create(
				range.start.line,
				0,
				range.start.line,
				editor.lineTextForBufferRow(selection.end.row).length
			);
		}
		return range;
	}
}
