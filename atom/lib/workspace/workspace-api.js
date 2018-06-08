// @flow
import { shell } from "electron";
import mixpanel from "mixpanel-browser";
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
		window.addEventListener("message", this.handleInteractionEvent, true);
		this.initialized = true;
	}

	handleInteractionEvent = ({ data }) => {
		if (data.type.startsWith("codestream"))
			console.debug("event", { type: data.type, body: data.body });
		if (data.type === "codestream:interaction:clicked-link") {
			shell.openExternal(data.body);
		}
		if (data.type === "codestream:analytics") {
			const { label, payload } = data.body;
			mixpanel.track(label, payload);
		}
		if (data.type === "codestream:request") {
			const { action, params } = data.body;
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
								{ type: "codestream:response", body: { action, payload: post } },
								"*"
							);
						})
						.catch(error => {
							window.parent.postMessage(
								{ type: "codestream:response", body: { action, error } },
								"*"
							);
						});
				}
				case "create-stream": {
					return this.api
						.createStream(params)
						.then(stream => {
							window.parent.postMessage(
								{ type: "codestream:response", body: { action, payload: stream } },
								"*"
							);
						})
						.catch(error => {
							window.parent.postMessage(
								{ type: "codestream:response", body: { action, error } },
								"*"
							);
						});
				}
				case "mark-stream-read": {
					return this.api.markStreamRead(params);
				}
				case "save-user-preference": {
					return this.api.saveUserPreference(params);
				}
			}
		}
	};

	destroy() {
		if (this.initialized) {
			window.removeEventListener("message", this.handleInteractionEvent, true);
			this.popupManager.destroy();
			this.bufferChangeTracker.destroy();
			this.diffManager.destroy();
			this.contentHighlighter.destroy();
			this.markerLocationTracker.destroy();
			this.editTracker.destroy();
		}
	}
}
