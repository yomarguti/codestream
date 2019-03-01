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

export interface WebviewContext {
	currentTeamId: string;
	hasFocus: boolean;

	currentStreamId?: string;
	threadId?: string;

	[key: string]: any;
}

export enum IpcRoutes {
	Agent = "codeStream",
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
