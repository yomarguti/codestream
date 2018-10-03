import EventEmitter from "./event-emitter";
import { shortUuid } from "./utils";

let sequence = 0;

export default class WebviewApi {
	pendingRequests = new Map();

	constructor() {
		this.host = EventEmitter.getHost();
		EventEmitter.on("response", ({ id, payload, error }) => {
			const request = this.pendingRequests.get(id);
			if (request) {
				console.debug("codestream:response", { id, payload, error });
				if (payload !== undefined) request.resolve(payload);
				else {
					request.reject(
						error ||
							`No payload and no error provided by host process in response to ${request.action}`
					);
				}
				this.pendingRequests.delete(id);
			}
		});
	}

	postMessage(message) {
		if (sequence === Number.MAX_SAFE_INTEGER) {
			sequence = 1;
		} else {
			sequence++;
		}

		const id = `${sequence}:${shortUuid()}`;
		return new Promise((resolve, reject) => {
			this.pendingRequests.set(id, { resolve, reject, action: message.action });
			console.debug("codestream:request", { id, ...message });
			this.host.postMessage({ type: "codestream:request", body: { id, ...message } }, "*");
		});
	}

	bootstrap() {
		return this.postMessage({ action: "bootstrap" });
	}

	startSignup() {
		return this.postMessage({ action: "go-to-signup" });
	}

	startSlackSignin() {
		return this.postMessage({ action: "go-to-slack-signin" });
	}

	validateSignup() {
		return this.postMessage({ action: "validate-signup" });
	}

	authenticate(params) {
		return this.postMessage({ action: "authenticate", params });
	}

	fetchPosts(params) {
		return this.postMessage({ action: "fetch-posts", params });
	}

	createPost(post) {
		return this.postMessage({ action: "create-post", params: post });
	}

	editPost(params) {
		return this.postMessage({ action: "edit-post", params });
	}

	reactToPost(params) {
		return this.postMessage({ action: "react-to-post", params });
	}

	deletePost(params) {
		return this.postMessage({ action: "delete-post", params });
	}

	createStream(stream) {
		return this.postMessage({ action: "create-stream", params: stream });
	}

	updateStream(streamId, update) {
		return this.postMessage({
			action: "update-stream",
			params: {
				streamId,
				update
			}
		});
	}

	joinStream(params) {
		return this.postMessage({ action: "join-stream", params });
	}

	leaveStream(teamId, streamId) {
		return this.postMessage({ action: "leave-stream", params: { teamId, streamId } });
	}

	invite(attributes) {
		return this.postMessage({ action: "invite", params: attributes });
	}

	markStreamRead(streamId) {
		return this.postMessage({ action: "mark-stream-read", params: { streamId } });
	}

	markPostUnread(streamId, postId) {
		return this.postMessage({
			action: "mark-post-unread",
			params: { streamId: streamId, id: postId }
		});
	}

	saveUserPreference(newPreference) {
		return this.postMessage({ action: "save-user-preference", params: newPreference });
	}

	async showCode(post, enteringThread) {
		return this.postMessage({ action: "show-code", params: { post, enteringThread } });
	}
}
