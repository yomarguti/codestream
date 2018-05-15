import { locationToRange } from "../util/Marker";

export default class DiffManager {
	diffMarkers = new Map();

	constructor(store) {
		this.store = store;
		window.addEventListener("message", this.handleInteractionEvent, true);
	}

	handleInteractionEvent = ({ data }) => {
		if (data.type === "codestream:interaction:show-diff") {
			const codeBlock = data.body;
			const displayMarkers = this.diffMarkers.get(codeBlock.markerId);
			if (displayMarkers) {
				displayMarkers.forEach(m => m.destroy());
				this.diffMarkers.delete(codeBlock.markerId);
			} else {
				const { context, markerLocations } = this.store.getState();
				const locationsByMarkerId = markerLocations.byCommit[context.currentCommit] || {};
				const editor = atom.workspace.getActiveTextEditor();

				const scrollToLine = (line, editor) => {
					editor.setCursorBufferPosition([line, 0]);
					editor.scrollToBufferPosition([line, 0], {
						center: true
					});
				};

				const location = locationsByMarkerId[codeBlock.markerId];
				if (location) {
					const meta = location[4] || {};
					const range = locationToRange(location);
					scrollToLine(range.start.row, editor);

					if (!meta.entirelyDeleted) {
						const marker = editor.markBufferRange(range);
						editor.decorateMarker(marker, {
							type: "line",
							class: "git-diff-details-old-highlighted"
						});
						this.diffMarkers.set(codeBlock.markerId, [marker]);
					}

					const diffEditor = atom.workspace.buildTextEditor({
						lineNumberGutterVisible: false,
						scrollPastEnd: false
					});

					diffEditor.setGrammar(editor.getGrammar());
					diffEditor.setText(codeBlock.code.replace(/[\r\n]+$/g, ""));

					const diffDiv = document.createElement("div");
					diffDiv.appendChild(atom.views.getView(diffEditor));

					const marker2 = editor.markBufferRange(range);
					const position = meta.entirelyDeleted ? "before" : "after";
					editor.decorateMarker(marker2, {
						type: "block",
						position,
						item: diffDiv
					});

					const marker3 = diffEditor.markBufferRange([[0, 0], [200, 0]]);
					diffEditor.decorateMarker(marker3, {
						type: "line",
						class: "git-diff-details-new-highlighted"
					});
					const existingMarkers = this.diffMarkers.get(codeBlock.markerId);
					this.diffMarkers.set(codeBlock.markerId, [...existingMarkers, marker2, marker3]);
				}
			}
		}
	};

	destroy() {
		window.removeEventListener("message", this.handleInteractionEvent, true);
	}
}
