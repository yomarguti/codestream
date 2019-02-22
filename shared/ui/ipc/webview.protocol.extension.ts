import { Range, RequestType } from "vscode-languageserver-protocol";

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
export const DidHighlightCodeNotificationType = new RequestType<
	DidHighlightCodeNotification,
	void,
	void,
	void
>("webview/code-highlighted");

export interface DidSelectStreamThreadNotification {
	streamId: string;
	threadId?: string;
}

export const DidSelectStreamThreadNotificationType = new RequestType<
	DidSelectStreamThreadNotification,
	void,
	void,
	void
>("webview/stream-thread-selected");

export interface DidScrollEditorNotification {
	uri: any; // vscode Uri type
	firstLine: number;
	lastLine: number;
}

export const DidScrollEditorNotificationType = new RequestType<
	DidScrollEditorNotification,
	void,
	void,
	void
>("webview/text-editor-scrolled");

export const DidChangeDataNotification = new RequestType<
	{ type: string; data: any },
	void,
	void,
	void
>("webview/data-changed");

export type DidChangeConfigsNotification = Partial<ConfigState>;

export const DidChangeConfigsNotificationType = new RequestType<
	DidChangeConfigsNotification,
	void,
	void,
	void
>("webview/configs-changed");

export const DidLoseConnectivityNotificationType = new RequestType<void, void, void, void>(
	"webview/connectivity-lost"
);

export const DidEstablishConnectivityNotificationType = new RequestType<void, void, void, void>(
	"webview/connectivity-established"
);

export interface DidChangeActiveEditorNotification {
	editor?: { fileName: string; fileStreamId?: string };
}

export const DidChangeActiveEditorNotificationType = new RequestType<
	DidChangeActiveEditorNotification,
	void,
	void,
	void
>("webview/active-editor-changed");

export const DidFocusNotification = new RequestType("webview/focused");
export const DidBlurNotification = new RequestType("webview/blurred");

export const DidSignOutNotificationType = new RequestType("webview/signed-out");
