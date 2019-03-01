import { NotificationType } from "vscode-jsonrpc";
import { IpcRoutes } from "./webview.protocol.common";

export * from "./webview.protocol.common";

export * from "./host.protocol";
export * from "./host.protocol.editor";
export * from "./host.protocol.notifications";
export * from "./host.protocol.vsls";

export * from "./webview.protocol.notifications";

// TODO: This should be a request to the webview -- not a notification
export interface DidSelectStreamThreadNotification {
	streamId: string;
	threadId?: string;
}

export const DidSelectStreamThreadNotificationType = new NotificationType<
	DidSelectStreamThreadNotification,
	void
>(`${IpcRoutes.Webview}/stream-thread-selected`);
