import AddCommentPopupManager from "./add-comment-popup-manager";
import BufferChangeTracker from "./buffer-change-tracker";
import DiffManager from "./diff-manager";
import ContentHighlighter from "./content-highlighter";

export default class CodeStreamApi {
	popupManager = null;
	bufferChangeTracker = null;
	diffManager = null;
	contentHighlighter = null;

	constructor(store) {
		this.store = store;
	}

	initialize() {
		const { repoAttributes } = this.store.getState();
		this.popupManager = new AddCommentPopupManager(repoAttributes.workingDirectory);
		this.bufferChangeTracker = new BufferChangeTracker(this.store, repoAttributes.workingDirectory);
		this.diffManager = new DiffManager(this.store);
		this.contentHighlighter = new ContentHighlighter(this.store);
	}

	destroy() {
		this.popupManager.destroy();
		this.bufferChangeTracker.destroy();
		this.diffManager.destroy();
		this.contentHighlighter.destroy();
	}
}
