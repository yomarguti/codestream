// @flow
import { shell } from "electron";
import { CompositeDisposable } from "atom";
import mixpanel from "mixpanel-browser";
import { EventEmitter } from "codestream-components";
import AddCommentPopupManager from "./add-comment-popup-manager";
import BufferChangeTracker from "./buffer-change-tracker";
import DiffManager from "./diff-manager";
import ContentHighlighter from "./content-highlighter";
import MarkerLocationTracker from "./marker-location-tracker";
import EditTracker from "./edit-tracker";
import CodeStreamApi from "../codestream-api";
import type { Resource, Store } from "../types";

export default class WorkspaceApi implements Resource {
	initialized: boolean = false;
	subscriptions = new CompositeDisposable();
	popupManager: Resource;
	bufferChangeTracker: Resource;
	diffManager: Resource;
	contentHighlighter: Resource;
	markerLocationTracker: Resource;
	editTracker: Resource;
	store: Store;
	api: CodeStreamApi;

	constructor(store: Store) {
		this.store = store;
	}

	initialize() {
		const { repoAttributes } = this.store.getState();
		this.api = new CodeStreamApi(this.store);
		this.popupManager = new AddCommentPopupManager(repoAttributes.workingDirectory);
		this.bufferChangeTracker = new BufferChangeTracker(this.store, repoAttributes.workingDirectory);
		this.diffManager = new DiffManager(this.store);
		this.contentHighlighter = new ContentHighlighter(this.store);
		this.markerLocationTracker = new MarkerLocationTracker(this.store);
		this.editTracker = new EditTracker(this.store);
		this.setupListeners();
		this.initialized = true;
	}

	setupListeners() {
		this.subscriptions.add(
			EventEmitter.on("interaction:clicked-link", link => shell.openExternal(link)),
			EventEmitter.on("analytics", ({ label, payload }) => mixpanel.track(label, payload)),
			EventEmitter.on("request", this.handleWebviewRequest)
		);
	}

	handleWebviewRequest = ({ id, action, params }) => {
		switch (action) {
			case "create-post": {
				return this.api
					.createPost(
						params.id,
						params.streamId,
						params.parentPostId,
						params.text,
						params.codeBlocks,
						params.mentions,
						params.extra
					)
					.then(post => {
						window.parent.postMessage(
							{ type: "codestream:response", body: { id, action, payload: post } },
							"*"
						);
					})
					.catch(error => {
						window.parent.postMessage(
							{ type: "codestream:response", body: { id, action, error } },
							"*"
						);
					});
			}
			case "edit-post": {
				return this.api
					.editPost(params.id, params.text, params.mentions)
					.then(post => {
						window.parent.postMessage(
							{ type: "codestream:response", body: { id, action, payload: post } },
							"*"
						);
					})
					.catch(error => {
						window.parent.postMessage(
							{ type: "codestream:response", body: { id, action, error } },
							"*"
						);
					});
			}
			case "delete-post": {
				return this.api
					.deletePost(params)
					.then(post => {
						window.parent.postMessage(
							{ type: "codestream:response", body: { id, action, payload: post } },
							"*"
						);
					})
					.catch(error => {
						window.parent.postMessage(
							{ type: "codestream:response", body: { id, action, error } },
							"*"
						);
					});
			}
			case "create-stream": {
				return this.api
					.createStream(params)
					.then(stream => {
						window.parent.postMessage(
							{ type: "codestream:response", body: { id, action, payload: stream } },
							"*"
						);
					})
					.catch(error => {
						window.parent.postMessage(
							{ type: "codestream:response", body: { id, action, error } },
							"*"
						);
					});
			}
			case "update-stream": {
				return this.api
					.updateStream(params)
					.then(stream => {
						window.parent.postMessage(
							{ type: "codestream:response", body: { id, action, payload: stream } },
							"*"
						);
					})
					.catch(error => {
						window.parent.postMessage(
							{ type: "codestream:response", body: { id, action, error } },
							"*"
						);
					});
			}
			case "mark-stream-read": {
				return this.api.markStreamRead(params).then(() => {
					window.parent.postMessage(
						{ type: "codestream:response", body: { id, action, payload: {} } },
						"*"
					);
				});
				// .catch(e => {
				// /* doesn't really matter */
				// });
			}
			case "save-user-preference": {
				return this.api.saveUserPreference(params).then(() => {
					window.parent.postMessage(
						{ type: "codestream:response", body: { id, action, payload: {} } },
						"*"
					);
				});
			}
		}
	};

	destroy() {
		if (this.initialized) {
			this.subscriptions.dispose();
			this.popupManager.destroy();
			this.bufferChangeTracker.destroy();
			this.diffManager.destroy();
			this.contentHighlighter.destroy();
			this.markerLocationTracker.destroy();
			this.editTracker.destroy();
		}
	}
}
