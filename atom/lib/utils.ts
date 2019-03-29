import { EditorSelection } from "@codestream/protocols/webview";
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
	export function getRelativePath(editor: TextEditor) {
		const filePath = editor.getPath();
		if (filePath === undefined) return filePath;
		return atom.project.relativize(filePath);
	}

	export function getUri(editor: TextEditor) {
		return Convert.pathToUri(editor.getPath() || "");
	}

	export function getCurrentSelectionRange(editor: TextEditor) {
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

	export function getCSSelections(editor: TextEditor): EditorSelection[] {
		return editor.getSelections().map(s => {
			const cursor = editor.getCursorBufferPosition();
			const { start, end } = Convert.atomRangeToLSRange(s.getBufferRange());
			return {
				cursor: { line: cursor.row, character: cursor.column },
				start,
				end,
			};
		});
	}

	export function getVisibleRanges(editor: TextEditor): Range[] {
		const [startLine, endLine] = (editor as any).getVisibleRowRange();
		return [Range.create(startLine, 0, endLine, 0)];
	}
}

interface CancelableFunction {
	(...args: any[]): any;
	cancel(): void;
}

export function throttle<F extends (...args: any[]) => any>(fn: F, time = 500): CancelableFunction {
	let requestId: any | undefined;
	let lastArgs: any[] = [];

	const throttledFn = function(...args: any[]) {
		lastArgs = args;
		if (requestId) {
			// console.warn(`throttling a call to ${fn}. new args are`, args);
			return;
		}
		requestId = setTimeout(() => {
			requestId = undefined;
			fn(...lastArgs);
		}, time);
	};

	throttledFn.cancel = () => {
		if (requestId) clearTimeout(requestId);
	};

	return throttledFn;
}
