// @flow
import { locationToRange } from "../util/Marker";
import { CODESTREAM_VIEW_URI } from "../codestream-view";
import type { DisplayMarker, Disposable } from "../types/atom";

type ReferenceElements = {
	marker: DisplayMarker,
	disposable: Disposable
};
type CodeBlock = {
	markerId: string,
	file: string
};

export default class ContentHighlighter {
	elements: Map<string, ReferenceElements> = new Map();
	store;

	constructor(store) {
		this.store = store;
		window.addEventListener("message", this.handleInteractionEvent, true);
	}

	handleInteractionEvent = ({ data }) => {
		if (data.type === "codestream:interaction:thread-selected") {
			const post = data.body;
			if (post.codeBlocks && post.codeBlocks.length > 0) {
				const { context, markerLocations } = this.store.getState();
				const locationsByMarkerId = markerLocations.byCommit[context.currentCommit] || {};
				const codeBlock = post.codeBlocks[0];
				this.highlightContent(codeBlock, locationsByMarkerId[codeBlock.markerId]);
			}
		}
		if (data.type === "codestream:interaction:thread-closed") {
			const post = data.body;
			if (post && post.codeBlocks && post.codeBlocks.length > 0) {
				this.removeContentHighlight(post.codeBlocks[0].markerId);
			}
		}
		if (data.type === "codestream:interaction:marker-selected") {
			const codeBlock = data.body;
			this.highlightContent(codeBlock, codeBlock.location);
		}
	};

	async highlightContent(codeBlock: CodeBlock, location) {
		atom.workspace.open(CODESTREAM_VIEW_URI);
		if (!this.elements.has(codeBlock.markerId)) {
			const editor = await atom.workspace.open(codeBlock.file);
			const range = locationToRange(location);
			editor.setCursorBufferPosition(range.start);
			editor.scrollToBufferPosition(range.start, {
				center: true
			});

			const marker = editor.markBufferRange(range, { invalidate: "never" });
			editor.decorateMarker(marker, {
				type: "highlight",
				class: "codestream-highlight"
			});
			const disposable = editor.onDidChangeSelectionRange(() => {
				this.removeContentHighlight(codeBlock.markerId);
			});
			this.elements.set(codeBlock.markerId, { marker, disposable });
		}
	}

	removeContentHighlight = (markerId: string) => {
		const referenceElements = this.elements.get(markerId);
		if (referenceElements) {
			referenceElements.marker.destroy();
			referenceElements.disposable.dispose();
			this.elements.delete(markerId);
		}
	};

	destroy() {
		window.removeEventListener("message", this.handleInteractionEvent, true);
		this.elements.forEach(({ marker, disposable }) => {
			marker.destroy();
			disposable.dispose();
		});
		this.elements.clear();
	}
}
