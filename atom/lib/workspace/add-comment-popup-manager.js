import { CompositeDisposable, Directory } from "atom";

export default class AddCommentPopupManager {
	editors = new Map();
	markers = new Map();
	subscriptions = new CompositeDisposable();

	constructor(repoPath) {
		const repoDirectory = new Directory(repoPath);

		this.subscriptions.add(
			atom.workspace.observeActiveTextEditor(editor => {
				if (editor && !this.editors.has(editor.id) && repoDirectory.contains(editor.getPath())) {
					this.editors.set(editor.id, editor);

					const marker = this.createMarker(editor);
					this.markers.set(editor.id, marker);

					this.subscriptions.add(
						editor.onDidDestroy(() => this.editors.delete(editor.id)),
						editor.onDidChangeSelectionRange(event =>
							this.handleChangeSelection(editor, marker, event)
						)
					);
				}
			})
		);
	}

	createMarker(editor) {
		const marker = editor.markBufferRange([[0, 0], [0, 0]], { invalidate: "touch" });
		const item = document.createElement("div");
		item.className = "codestream-comment-popup";
		const bubble = document.createElement("div");
		bubble.innerHTML = "+";
		item.appendChild(bubble);
		item.onclick = () => {
			console.log("TODO: handle clicking of bubble");
			// this.props.onClick();
			// this.destroyMarker();
		};
		// TODO: capture this in subscriptions
		this.subscriptions.add(
			atom.tooltips.add(item, {
				title: "Add a comment"
			})
		);
		marker.setProperties({ item });
		return marker;
	}

	handleChangeSelection(editor, marker, event) {
		const selectedLength = editor.getSelectedText().length;

		console.debug("selection", editor.getSelectedText());

		const shouldShowMarker =
			selectedLength > 0 && !event.newBufferRange.isEqual(event.oldBufferRange);

		if (shouldShowMarker) {
			const range = editor.getSelectedBufferRange();
			let row = range.start.row > range.end.row ? range.end.row : range.start.row;
			let startRange = [[row, 0], [row, 0]];

			const decoration = editor.decorateMarker(marker, {
				item: marker.getProperties().item,
				type: "overlay",
				class: "codestream-overlay"
			});
			console.debug("SHOWING MARKER");

			marker.setBufferRange(startRange);
			marker.setProperties({ decoration });
		} else {
			const { decoration } = marker.getProperties();
			decoration && decoration.destroy();
			console.log("HIDING MARKER");
		}
	}

	destroy() {
		this.subscriptions.dispose();
		this.editors.clear();
		this.markers.clear();
	}
}
