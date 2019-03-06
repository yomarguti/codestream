"user strict";
import {
	commands,
	DecorationRangeBehavior,
	Range,
	TextDocumentShowOptions,
	Uri,
	ViewColumn,
	window,
	workspace
} from "vscode";
import { BuiltInCommands } from "./constants";
import { Logger } from "./logger";

// DEPRECATED:
export enum ShowCodeResult {
	Success = "SUCCESS",
	FileNotFound = "FILE_NOT_FOUND",
	RepoNotInWorkspace = "REPO_NOT_IN_WORKSPACE"
}

const highlightDecorationType = window.createTextEditorDecorationType({
	rangeBehavior: DecorationRangeBehavior.OpenOpen,
	backgroundColor: "rgba(127, 127, 127, 0.4)"
});

// DEPRECATED:
export async function openEditor(
	uri: Uri,
	options: TextDocumentShowOptions & { rethrow?: boolean; highlight?: Range } = {}
): Promise<ShowCodeResult | undefined> {
	const { rethrow, highlight, ...opts } = options;
	try {
		const document = await workspace.openTextDocument(uri);
		window
			.showTextDocument(document, {
				preserveFocus: false,
				preview: true,
				viewColumn: ViewColumn.Active,
				...opts
			})
			.then(editor => {
				editor.setDecorations(highlightDecorationType, highlight ? [highlight] : []);
			});
		return ShowCodeResult.Success;
	} catch (ex) {
		const msg = ex.toString();
		if (msg.includes("File not found")) {
			return ShowCodeResult.FileNotFound;
		}

		if (msg.includes("File seems to be binary and cannot be opened as text")) {
			await commands.executeCommand(BuiltInCommands.Open, uri);

			return undefined;
		}

		if (rethrow) throw ex;

		Logger.error(ex, "openEditor");
		return undefined;
	}
}

export enum ContextKeys {
	LiveShareInstalled = "codestream:liveShareInstalled",
	LiveShareSessionActive = "codestream:liveShareSessionActive",
	Status = "codestream:status"
}

export function setContext(key: ContextKeys | string, value: any) {
	return commands.executeCommand(BuiltInCommands.SetContext, key, value);
}

export enum GlobalState {
	AccessTokens = "codestream:accessTokens"
}

export enum WorkspaceState {
	webviewState = "codestream:webviewState",
	TeamId = "codestream:teamId"
}
