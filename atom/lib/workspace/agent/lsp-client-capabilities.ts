import { ClientCapabilities } from "vscode-languageserver-protocol";

export const LSP_CLIENT_CAPABILITIES: ClientCapabilities = {
	workspace: {
		applyEdit: true,
		configuration: true,
		workspaceEdit: {
			documentChanges: true,
		},
		workspaceFolders: true,
		didChangeConfiguration: {
			dynamicRegistration: false,
		},
		didChangeWatchedFiles: {
			dynamicRegistration: false,
		},
		symbol: {
			dynamicRegistration: false,
		},
		executeCommand: {
			dynamicRegistration: false,
		},
	},
	textDocument: {
		declaration: {},
		synchronization: {
			dynamicRegistration: false,
			willSave: true,
			willSaveWaitUntil: true,
			didSave: true,
		},
		completion: {
			dynamicRegistration: false,
			completionItem: {
				snippetSupport: true,
				commitCharactersSupport: false,
			},
			contextSupport: true,
		},
		hover: {
			dynamicRegistration: false,
		},
		signatureHelp: {
			dynamicRegistration: false,
		},
		references: {
			dynamicRegistration: false,
		},
		documentHighlight: {
			dynamicRegistration: false,
		},
		documentSymbol: {
			dynamicRegistration: false,
			hierarchicalDocumentSymbolSupport: true,
		},
		formatting: {
			dynamicRegistration: false,
		},
		rangeFormatting: {
			dynamicRegistration: false,
		},
		onTypeFormatting: {
			dynamicRegistration: false,
		},
		definition: {
			dynamicRegistration: false,
		},
		codeAction: {
			dynamicRegistration: false,
		},
		codeLens: {
			dynamicRegistration: false,
		},
		documentLink: {
			dynamicRegistration: false,
		},
		rename: {
			dynamicRegistration: false,
		},

		// We do not support these features yet.
		// Need to set to undefined to appease TypeScript weak type detection.
		implementation: undefined,
		typeDefinition: undefined,
		colorProvider: undefined,
		foldingRange: undefined,
	},
	experimental: {},
};
