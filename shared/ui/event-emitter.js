class EventEmitter {
	listenersByEvent = new Map();

	constructor() {
		window.parent.addEventListener("message", this.handler, false);
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
}

const emmitter = new EventEmitter();
export default emmitter;
