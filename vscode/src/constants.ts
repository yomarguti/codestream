"use strict";

export const extensionId = "codestream";
export const extensionOutputChannelName = "CodeStream";
export const extensionQualifiedId = `CodeStream.${extensionId}`;

export enum BuiltInCommands {
	CloseActiveEditor = "workbench.action.closeActiveEditor",
	CloseAllEditors = "workbench.action.closeAllEditors",
	CursorMove = "cursorMove",
	Diff = "vscode.diff",
	EditorScroll = "editorScroll",
	ExecuteDocumentSymbolProvider = "vscode.executeDocumentSymbolProvider",
	ExecuteCodeLensProvider = "vscode.executeCodeLensProvider",
	Open = "vscode.open",
	NextEditor = "workbench.action.nextEditor",
	PreviewHtml = "vscode.previewHtml",
	RevealLine = "revealLine",
	ReloadWindow = "workbench.action.reloadWindow",
	SetContext = "setContext",
	ShowCodeStream = "workbench.view.extension.codestream",
	ShowReferences = "editor.action.showReferences"
}

export const emptyArray = (Object.freeze([]) as any) as any[];
export const emptyObj = Object.freeze({});
