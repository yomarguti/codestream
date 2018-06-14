import EventEmitter from "./event-emitter";
import { uuid } from "./utils";

export default class WebviewApi {
	pendingRequests = new Map();

	constructor() {
		this.host = EventEmitter.getHost();
		window.addEventListener(
			"message",
			event => {
				const { type, body } = event.data;
				if (type === "codestream:response") {
					const { id } = body;
					const request = this.pendingRequests.get(id);
					if (request) {
						if (body.payload) request.resolve(body.payload);
						else {
							request.reject(
								body.error || `No error provided by host process in response to ${request.action}`
							);
						}
						this.pendingRequests.delete(id);
					}
				}
			},
			false
		);
	}

	postMessage(message) {
		const id = uuid();
		return new Promise((resolve, reject) => {
			this.pendingRequests.set(id, { resolve, reject, action: message.action });
			this.host.postMessage({ type: "codestream:request", body: { id, ...message } }, "*");
		});
	}

	createPost(post) {
		return this.postMessage({ action: "create-post", params: post });
	}

	editPost(params) {
		return this.postMessage({ action: "edit-post", params });
	}

	deletePost(params) {
		return this.postMessage({ action: "delete-post", params });
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
