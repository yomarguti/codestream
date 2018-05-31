export default class WebviewIpc {
	pendingRequests = new Map();

	constructor(host) {
		this.host = host;
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
}
