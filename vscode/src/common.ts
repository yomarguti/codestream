"user strict";
import { commands, TextDocumentShowOptions, Uri, ViewColumn, window, workspace } from "vscode";
import { BuiltInCommands } from "./commands";
import { Logger } from "./logger";

export enum ShowCodeResult {
	Success = "SUCCESS",
	FileNotFound = "FILE_NOT_FOUND",
	RepoNotInWorkspace = "REPO_NOT_IN_WORKSPACE"
}

export async function openEditor(
	uri: Uri,
	options: TextDocumentShowOptions & { rethrow?: boolean } = {}
): Promise<ShowCodeResult | undefined> {
	const { rethrow, ...opts } = options;
	try {
		const document = await workspace.openTextDocument(uri);
		window.showTextDocument(document, {
			preserveFocus: false,
			preview: true,
			viewColumn: ViewColumn.Active,
			...opts
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
