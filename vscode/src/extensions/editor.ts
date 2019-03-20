"use strict";

import { EditorMetrics, EditorSelection } from "@codestream/protocols/webview";
import {
	commands,
	DecorationRangeBehavior,
	Range,
	Selection,
	TextDocumentShowOptions,
	TextEditor,
	TextEditorRevealType,
	Uri,
	ViewColumn,
	window,
	workspace
} from "vscode";
import { Range as LspRange } from "vscode-languageclient";
import { configuration } from "../configuration";
import { BuiltInCommands, emptyArray } from "../constants";
import { Container } from "../container";
import { Logger } from "../logger";

const highlightDecorationType = window.createTextEditorDecorationType({
	rangeBehavior: DecorationRangeBehavior.OpenOpen,
	backgroundColor: "rgba(127, 127, 127, 0.4)"
});

export namespace Editor {
	export async function findOrOpenEditor(
		uri: Uri,
		options: TextDocumentShowOptions & { rethrow?: boolean } = {}
	): Promise<TextEditor | undefined> {
		const normalizedUri = uri.toString(false);

		for (const e of window.visibleTextEditors) {
			if (e.document.uri.toString(false) === normalizedUri) {
				return e;
			}
		}

		// FYI, this doesn't always work, see https://github.com/Microsoft/vscode/issues/56097
		let column = Container.webview.viewColumn as number | undefined;
		if (column !== undefined) {
			column--;
			if (column <= 0) {
				column = undefined;
			}
		}

		return openEditor(uri, { viewColumn: column, ...options });
	}

	export function getActiveOrVisible(active?: TextEditor) {
		const editor = active || window.activeTextEditor;
		if (editor !== undefined && Editor.isTextEditor(editor)) {
			return editor;
		}

		if (window.visibleTextEditors.length !== 0) {
			for (const e of window.visibleTextEditors) {
				if (Editor.isTextEditor(e)) {
					return e;
				}
			}
		}

		return undefined;
	}

	export function getMetrics(): EditorMetrics {
		const metrics: EditorMetrics = {};

		const lineHeight = configuration.getAny<number | undefined>("editor.lineHeight");
		metrics.lineHeight = lineHeight;

		const fontSize = configuration.getAny<number | undefined>("editor.fontSize");
		metrics.fontSize = fontSize;

		const breadcrumbs = configuration.getAny<boolean>("breadcrumbs.enabled", undefined, false);
		if (breadcrumbs) {
			metrics.margins = { top: 22 };
		}

		return metrics;
	}

	export async function highlightRange(uri: Uri, range: Range, clear?: boolean): Promise<boolean> {
		const editor = await findOrOpenEditor(uri, { preserveFocus: true });
		if (editor === undefined) return false;

		editor.setDecorations(highlightDecorationType, clear ? emptyArray : [range]);
		return true;
	}

	export function isTextEditor(editor: TextEditor): boolean {
		const scheme = editor.document.uri.scheme;
		return scheme !== "output" && scheme !== "debug";
	}

	export async function revealRange(
		uri: Uri,
		range: Range,
		options: TextDocumentShowOptions
	): Promise<boolean> {
		const editor = await findOrOpenEditor(uri, { ...options });
		if (editor === undefined) return false;

		editor.revealRange(range, TextEditorRevealType.InCenterIfOutsideViewport);
		return true;
	}

	export async function selectRange(
		uri: Uri,
		range: Range,
		options: TextDocumentShowOptions
	): Promise<boolean> {
		const editor = await findOrOpenEditor(uri, { ...options });
		if (editor === undefined) return false;

		editor.selection = new Selection(range.end, range.start);
		return true;
	}

	export async function openEditor(
		uri: Uri,
		options: TextDocumentShowOptions & { rethrow?: boolean } = {}
	): Promise<TextEditor | undefined> {
		const { rethrow, ...opts } = options;
		try {
			const document = await workspace.openTextDocument(uri);
			return window.showTextDocument(document, {
				preserveFocus: false,
				preview: true,
				viewColumn: ViewColumn.Active,
				...opts
			});
		} catch (ex) {
			const msg = ex.toString();
			if (msg.includes("File seems to be binary and cannot be opened as text")) {
				await commands.executeCommand(BuiltInCommands.Open, uri);
				return undefined;
			}

			if (rethrow) throw ex;

			Logger.error(ex, "openEditor");
			return undefined;
		}
	}

	export function toEditorSelections(selections: Selection[]): EditorSelection[] {
		return selections.map(s => ({ cursor: s.active, start: s.start, end: s.end }));
	}

	export function fromSerializableRange(range: LspRange): Range;
	export function fromSerializableRange(ranges: LspRange[]): Range[];
	export function fromSerializableRange(ranges: LspRange | LspRange[]): Range | Range[] {
		if (!Array.isArray(ranges)) {
			return new Range(
				ranges.start.line,
				ranges.start.character,
				ranges.end.line,
				ranges.end.character
			);
		}

		return ranges.map(r => new Range(r.start.line, r.start.character, r.end.line, r.end.character));
	}

	export function toSerializableRange(range: Range): LspRange;
	export function toSerializableRange(ranges: Range[]): LspRange[];
	export function toSerializableRange(ranges: Range | Range[]): LspRange | LspRange[] {
		if (!Array.isArray(ranges)) {
			return { start: ranges.start, end: ranges.end };
		}

		return ranges.map(r => ({ start: r.start, end: r.end }));
	}
}
