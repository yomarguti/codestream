import { NotificationType } from "vscode-jsonrpc";
import { IpcRoutes, WebviewContext } from "./webview.protocol.common";

export interface WebviewDidInitializeNotification {}

export const WebviewDidInitializeNotificationType = new NotificationType<
	WebviewDidInitializeNotification,
	void
>(`${IpcRoutes.Host}/didInitialize`);

export interface WebviewDidChangeActiveStreamNotification {
	streamId?: string;
}

export const WebviewDidChangeActiveStreamNotificationType = new NotificationType<
	WebviewDidChangeActiveStreamNotification,
	void
>(`${IpcRoutes.Host}/stream/didChangeActive`);

export interface WebviewDidChangeContextNotification {
	context: WebviewContext;
}
export const WebviewDidChangeContextNotificationType = new NotificationType<
	WebviewDidChangeContextNotification,
	void
>(`${IpcRoutes.Host}/context/didChange`);

export interface WebviewDidOpenThreadNotification {
	streamId: string;
	threadId?: string;
}
export const WebviewDidOpenThreadNotificationType = new NotificationType<
	WebviewDidOpenThreadNotification,
	void
>(`${IpcRoutes.Host}/thread/didOpen`);

export interface WebviewDidCloseThreadNotification {
	threadId?: string;
}

export const WebviewDidCloseThreadNotificationType = new NotificationType<
	WebviewDidCloseThreadNotification,
	void
>(`${IpcRoutes.Host}/thread/didClose`);
