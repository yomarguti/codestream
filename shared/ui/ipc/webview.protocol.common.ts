import { Position, Range } from "vscode-languageserver-types";

export const MaxRangeValue = 2147483647;

export interface EditorMargins {
	top?: number;
	right?: number;
	bottom?: number;
	left?: number;
}

export interface EditorMetrics {
	fontSize?: number;
	lineHeight?: number;
	margins?: EditorMargins;
}

export interface EditorSelection extends Range {
	cursor: Position;
}

export interface WebviewContext {
	currentTeamId: string;
	currentStreamId?: string;
	threadId?: string;
	hasFocus: boolean;

	textEditorMetrics?: EditorMetrics;
	textEditorSelections?: EditorSelection[];
	textEditorVisibleRanges?: Range[];
	textEditorUri?: string;
}

export interface IpcHost {
	postMessage<R>(message: WebviewIpcMessage, targetOrgigin: string, transferable?: any): Promise<R>;
	postMessage<R>(message: WebviewIpcMessage): Promise<R>;
	onmessage: any;
}

declare function acquireCodestreamHost(): IpcHost;

let host: IpcHost;
export const findHost = (): IpcHost => {
	if (host) return host;
	try {
		host = acquireCodestreamHost();
	} catch (e) {
		throw new Error("Host needs to provide global `acquireCodestreamHost` function");
	}
	return host;
};

export enum IpcRoutes {
	Agent = "codestream",
	Host = "host",
	Webview = "webview"
}

export interface WebviewIpcNotificationMessage {
	method: string;
	params?: any;
}

export interface WebviewIpcRequestMessage {
	id: string;
	method: string;
	params?: any;
}

export interface WebviewIpcResponseMessage {
	id: string;
	params?: any;
	error?: any;
}

export type WebviewIpcMessage =
	| WebviewIpcNotificationMessage
	| WebviewIpcRequestMessage
	| WebviewIpcResponseMessage;

// Don't use as for some reason it isn't a valid type guard
// export function isIpcNotificationMessage(
// 	msg: WebviewIpcMessage
// ): msg is WebviewIpcNotificationMessage {
// 	return (msg as any).method != null && (msg as any).id == null;
// }

export function isIpcRequestMessage(msg: WebviewIpcMessage): msg is WebviewIpcRequestMessage {
	return (msg as any).method != null && (msg as any).id != null;
}

export function isIpcResponseMessage(msg: WebviewIpcMessage): msg is WebviewIpcResponseMessage {
	return (msg as any).method == null && (msg as any).id != null;
}
