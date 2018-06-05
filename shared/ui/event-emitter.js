class EventEmitter {
	listenersByEvent = new Map();

	constructor() {
		this.host = acquireVsCodeApi ? acquireVsCodeApi() : window.parent;
		window.addEventListener("message", this.handler, false);
	}

	getHost() {
		return this.host;
	}

	handler = ({ data }) => {
		if (data.type.startsWith("codestream")) {
			const event = data.type.replace("codestream:", "");
			const listeners = this.listenersByEvent.get(event) || [];
			listeners.forEach(l => l(data.body));
		}
	};

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
}

const emitter = new EventEmitter();
export default emitter;
