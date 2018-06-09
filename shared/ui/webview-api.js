import EventEmitter from "./event-emitter";

export default class WebviewApi {
	pendingRequests = new Map();

	constructor() {
		this.host = EventEmitter.getHost();
		window.addEventListener(
			"message",
			event => {
				const { type, body } = event.data;
				if (type === "codestream:response") {
					const { resolve, reject } = this.pendingRequests.get(body.action);
					if (body.payload) {
						if (resolve) {
							resolve(body.payload);
						}
					} else {
						if (reject) {
							reject(body.error);
						}
					}
					this.pendingRequests.delete(body.action);
				}
			},
			false
		);
	}

	postMessage(message) {
		return new Promise((resolve, reject) => {
			this.pendingRequests.set(message.action, { resolve, reject });
			this.host.postMessage({ type: "codestream:request", body: message }, "*");
		});
	}

	createPost(post) {
		return this.postMessage({ action: "create-post", params: post });
	}

	createStream(stream) {
		return this.postMessage({ action: "create-stream", params: stream });
	}

	updateStream(streamId, update) {
		console.log("posting message...");
		return this.postMessage({
			action: "update-stream",
			params: {
				streamId,
				update
			}
		});
	}

	markStreamRead(streamId) {
		return this.postMessage({ action: "mark-stream-read", params: streamId });
	}

	saveUserPreference(newPreference) {
		return this.postMessage({ action: "save-user-preference", params: newPreference });
	}
}
