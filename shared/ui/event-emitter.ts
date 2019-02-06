export interface IpcMessage {
	type: string;
	body: any;
}

export interface IpcHost {
	postMessage(message: IpcMessage, origin: string): undefined;
}

export interface IpcRequest {
	id: string;
	action: string;
	params: any;
}

export interface IpcResponse {
	id: string;
	payload?: any;
	error?: any;
}

declare function acquireCodestreamHost(): IpcHost;

declare function acquireVsCodeApi(): IpcHost;

let host;
const findHost = () => {
	if (host) return host;

	host = window.parent as IpcHost;
	try {
		host = acquireCodestreamHost();
	} catch (e) {
		try {
			// Legacy
			host = acquireVsCodeApi();
		} catch (e) {}
	}
	return host;
};

class EventEmitter {
	listenersByEvent = new Map<string, Function[]>();

	constructor() {
		window.addEventListener("message", this.handler, false);
	}

	get host() {
		return findHost();
	}

	handler = ({ data }: MessageEvent) => {
		if (data != null && data.type != null && data.type.startsWith("codestream")) {
			const event = data.type.replace("codestream:", "");
			if (event !== "response") console.debug(`[${event}] event received`, data.body);
			const listeners = this.listenersByEvent.get(event) || [];
			setImmediate(() => listeners.forEach(l => l(data.body)));
		}
	}

	on(thing: string, listener: Function) {
		return this.subscribe(thing, listener);
	}

	subscribe(thing: string, listener: Function) {
		const listeners = this.listenersByEvent.get(thing) || [];
		listeners.push(listener);
		this.listenersByEvent.set(thing, listeners);
		return {
			dispose: () => {
				const listeners = this.listenersByEvent.get(thing)!.filter(l => l !== listener);
				this.listenersByEvent.set(thing, listeners);
			}
		};
	}

	emit(event: string, body: any) {
		this.host.postMessage(
			{
				type: `codestream:${event}`,
				body
			},
			"*"
		);
	}

	onFileChanged(block: any, listener: any) {
		this.emit("subscription:file-changed", block);
		const disposable = this.on("publish:file-changed", listener);
		return {
			dispose: () => {
				disposable.dispose();
				this.emit("unsubscribe:file-changed", block);
			}
		};
	}
}

const emitter = new EventEmitter();
export { emitter as EventEmitter };
