import { NotificationType } from "vscode-jsonrpc";
import { Position, Range } from "vscode-languageserver-types";
import { IpcRoutes } from "./webview.protocol.common";

type ConfigState = any;

/* The following events are expected to be provided from the extension */

export interface HostDidChangeActiveEditorNotification {
	editor?: {
		fileName: string;
		fileStreamId?: string;
		languageId?: string;
		uri: string;
		margins?: { top?: number; right?: number; bottom?: number; left?: number; };
		selections: EditorSelection[];
		visibleRanges: Range[];
	};
}
export const HostDidChangeActiveEditorNotificationType = new NotificationType<
	HostDidChangeActiveEditorNotification,
	void
>(`${IpcRoutes.Webview}/editor/didChangeActive`);

export interface EditorSelection extends Range {
	cursor: Position;
}

export type HostDidChangeConfigNotification = Partial<ConfigState>;
export const HostDidChangeConfigNotificationType = new NotificationType<
	HostDidChangeConfigNotification,
	void
>(`${IpcRoutes.Webview}/config/didChange`);

export interface HostDidChangeEditorSelectionNotification {
	uri: string;
	selections: EditorSelection[];
	visibleRanges: Range[];
}
export const HostDidChangeEditorSelectionNotificationType = new NotificationType<
	HostDidChangeEditorSelectionNotification,
	void
>(`${IpcRoutes.Webview}/editor/didChangeSelection`);

export interface HostDidChangeEditorVisibleRangesNotification {
	uri: string;
	selections: EditorSelection[];
	visibleRanges: Range[];
}
export const HostDidChangeEditorVisibleRangesNotificationType = new NotificationType<
	HostDidChangeEditorVisibleRangesNotification,
	void
>(`${IpcRoutes.Webview}/editor/didChangeVisibleRanges`);

export interface HostDidChangeFocusNotification {
	focused: boolean;
}
export const HostDidChangeFocusNotificationType = new NotificationType<
	HostDidChangeFocusNotification,
	void
>(`${IpcRoutes.Webview}/focus/didChange`);

export interface HostDidLogoutNotification {}
export const HostDidLogoutNotificationType = new NotificationType<HostDidLogoutNotification, void>(
	`${IpcRoutes.Webview}/didLogout`
);

// DEPRECATED:
export interface HostDidSelectCodeNotification {
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
	type?: string;
}
export const HostDidSelectCodeNotificationType = new NotificationType<
	HostDidSelectCodeNotification,
	void
>(`${IpcRoutes.Webview}/editor/didSelectCode`);
