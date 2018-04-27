import { normalize } from "./actions/utils";

const normalizeResponse = response => {
	return Object.entries(response).reduce((result, [key, value]) => {
		result[key] = normalize(value);
		return result;
	}, {});
};

export const vscode = acquireVsCodeApi();

export default class CodeStreamVSWebviewApi {
	pendingRequests = new Map();

	constructor() {
		window.addEventListener(
			"message",
			(event) => {
				const { type, body } = event.data
				if (type === 'action-response') {
					console.log('received action response', {type, body});
					const resolve = this.pendingRequests.get(body.action);
					if (resolve) {
						resolve(body.payload);
						this.pendingRequests.delete(body.action);
					}
				}
			},
			false
		);
	}

	postMessage(message) {
		return new Promise((resolve, reject) => {
			this.pendingRequests.set(message.action, resolve);
			debugger;
			vscode.postMessage({ type: "action-request", body: message }, "*");
		});
	}

	createPost(post) {
		return this.postMessage({ action: "post", params: post });
	}
}
