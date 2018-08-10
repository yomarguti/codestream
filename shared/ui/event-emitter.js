const findHost = () => {
	try {
		return acquireVsCodeApi();
	} catch (e) {
		/* probably not in vscode */
		return window.parent;
	}
};

class EventEmitter {
	listenersByEvent = new Map();

	constructor() {
		this.host = findHost();
		window.addEventListener("message", this.handler, false);
	}

	getHost() {
		return this.host;
	}

	handler = ({ data }) => {
		if (data.type.startsWith("codestream")) {
			const event = data.type.replace("codestream:", "");
			if (event !== "response") console.debug(`[${event}] event received`, data.body);
			const listeners = this.listenersByEvent.get(event) || [];
			listeners.forEach(l => l(data.body));
		}
	};

	on(thing, listener) {
		return this.subscribe(thing, listener);
	}

	subscribe(thing, listener) {
		const listeners = this.listenersByEvent.get(thing) || [];
		listeners.push(listener);
		this.listenersByEvent.set(thing, listeners);
		return {
			dispose: () => {
				const listeners = this.listenersByEvent.get(thing).filter(l => l !== listener);
				this.listenersByEvent.set(thing, listeners);
			}
		};
	}

	emit(event, body) {
		this.host.postMessage(
			{
				type: `codestream:${event}`,
				body
			},
			"*"
		);
	}

	onFileChanged(block, listener) {
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
export default emitter;
