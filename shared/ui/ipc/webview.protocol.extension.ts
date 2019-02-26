import { NotificationType } from "vscode-jsonrpc";
import { Range } from "vscode-languageserver-types";

type ConfigState = any;

/* The following events are expected to be provided from the extension */

export interface DidHighlightCodeNotification {
	code: string;
	file: string | undefined;
	fileUri: string;
	range: Range;
	source:
		| {
				file: string;
				repoPath: string;
				revision: string;
				authors: {
					id: string;
					username: string;
				}[];
				remotes: {
					name: string;
					url: string;
				}[];
		  }
		| undefined;
	gitError: string | undefined;
	isHighlight?: boolean;
}
export const DidHighlightCodeNotificationType = new NotificationType<
	DidHighlightCodeNotification,
	void
>("webview/code-highlighted");

export interface DidSelectStreamThreadNotification {
	streamId: string;
	threadId?: string;
}

export const DidSelectStreamThreadNotificationType = new NotificationType<
	DidSelectStreamThreadNotification,
	void
>("webview/stream-thread-selected");

export interface DidScrollEditorNotification {
	uri: any; // vscode Uri type
	firstLine: number;
	lastLine: number;
}

export const DidScrollEditorNotificationType = new NotificationType<
	DidScrollEditorNotification,
	void
>("webview/text-editor-scrolled");

export const DidChangeDataNotification = new NotificationType<{ type: string; data: any }, void>(
	"webview/data-changed"
);

export type DidChangeConfigsNotification = Partial<ConfigState>;

export const DidChangeConfigsNotificationType = new NotificationType<
	DidChangeConfigsNotification,
	void
>("webview/configs-changed");

export const DidLoseConnectivityNotificationType = new NotificationType<void, void>(
	"webview/connectivity-lost"
);

export const DidEstablishConnectivityNotificationType = new NotificationType<void, void>(
	"webview/connectivity-established"
);

export interface DidChangeActiveEditorNotification {
	editor?: { fileName: string; fileStreamId?: string };
}

export const DidChangeActiveEditorNotificationType = new NotificationType<
	DidChangeActiveEditorNotification,
	void
>("webview/active-editor-changed");

export const DidFocusNotificationType = new NotificationType("webview/focused");
export const DidBlurNotificationType = new NotificationType("webview/blurred");

export const DidSignOutNotificationType = new NotificationType("webview/signed-out");
