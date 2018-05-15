import { locationToRange } from "../util/Marker";
import { CODESTREAM_VIEW_URI } from "../codestream-view";

export default class ContentHighlighter {
	displayMarkers = new Map();

	constructor(store) {
		this.store = store;
		window.addEventListener("message", this.handleInteractionEvent, true);
	}

	handleInteractionEvent = ({ data }) => {
		if (data.type === "codestream:interaction:thread-selected") {
			const post = data.body;
			const { context, markerLocations } = this.store.getState();
			const locationsByMarkerId = markerLocations.byCommit[context.currentCommit] || {};
			const codeBlock = post.codeBlocks[0];
			this.highlightContent(codeBlock, locationsByMarkerId[codeBlock.markerId]);
		}
		if (data.type === "codestream:interaction:thread-closed") {
			this.removeContentHighlight(data.body.codeBlocks[0].markerId);
		}
		if (data.type === "codestream:interaction:marker-selected") {
			const codeBlock = data.body;
			this.highlightContent(codeBlock, codeBlock.location);
		}
	};

	async highlightContent(codeBlock, location) {
		atom.workspace.open(CODESTREAM_VIEW_URI);
		if (!this.displayMarkers.has(codeBlock.markerId)) {
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
			this.displayMarkers.set(codeBlock.markerId, { marker, disposable });
		}
	}

	removeContentHighlight = markerId => {
		const displayMarker = this.displayMarkers.get(markerId);
		if (displayMarker) {
			displayMarker.marker.destroy();
			displayMarker.disposable.dispose();
			this.displayMarkers.delete(markerId);
		}
	};

	destroy() {
		window.removeEventListener("message", this.handleInteractionEvent, true);
		this.displayMarkers.forEach((_markerId, { marker, disposable }) => {
			marker.destroy();
			disposable.dispose();
		});
		this.displayMarkers.clear();
	}
}
