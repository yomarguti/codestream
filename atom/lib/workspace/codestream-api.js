// @flow
import AddCommentPopupManager from "./add-comment-popup-manager";
import BufferChangeTracker from "./buffer-change-tracker";
import DiffManager from "./diff-manager";
import ContentHighlighter from "./content-highlighter";
import MarkerLocationTracker from "./marker-location-tracker";
import type { Resource, Store } from "../types/codestream";

export default class CodeStreamApi {
	popupManager: Resource;
	bufferChangeTracker: Resource;
	diffManager: Resource;
	contentHighlighter: Resource;
	markerLocationTracker: Resource;
	store: Store;

	constructor(store: Store) {
		this.store = store;
	}

	initialize() {
		const { repoAttributes } = this.store.getState();
		this.popupManager = new AddCommentPopupManager(repoAttributes.workingDirectory);
		this.bufferChangeTracker = new BufferChangeTracker(this.store, repoAttributes.workingDirectory);
		this.diffManager = new DiffManager(this.store);
		this.contentHighlighter = new ContentHighlighter(this.store);
		this.markerLocationTracker = new MarkerLocationTracker(this.store);
	}

	destroy() {
		this.popupManager.destroy();
		this.bufferChangeTracker.destroy();
		this.diffManager.destroy();
		this.contentHighlighter.destroy();
		this.markerLocationTracker.destroy();
	}
}
