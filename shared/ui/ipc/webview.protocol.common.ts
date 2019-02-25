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

export interface WebviewIpcMessage {
	id?: string;
	method: string;
	params?: any;
	error?: any;
}

/*
	This is a properly serializable class for the postMessage api.
	The `NotificationType` provided by vscode-languageserver-protocol has a getter for `method`
	which is not serialized.
*/
export class NotificationType<P, R = void> implements WebviewIpcMessage {
	_?: [P, R];
	constructor(public readonly method: string) {}
}
