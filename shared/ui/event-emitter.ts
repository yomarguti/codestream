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

declare function acquireVsCodeApi(): IpcHost;

const findHost = () => {
	try {
		return acquireVsCodeApi();
	} catch (e) {
		/* probably not in vscode */
		return window.parent as IpcHost;
	}
};

class EventEmitter {
	listenersByEvent = new Map<string, Function[]>();
	host: IpcHost;

	constructor() {
		this.host = findHost();
		window.addEventListener("message", this.handler, false);
	}

	getHost() {
		return this.host;
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
export default emitter;
