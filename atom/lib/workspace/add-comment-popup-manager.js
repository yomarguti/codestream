import { CompositeDisposable, Directory } from "atom";
import Blamer from "../util/blamer";

const trimSelection = editor => {
	const lastColumnInRow = (buffer, row) => {
		const line = buffer.lineForRow(row);
		const lastColumn = line.length;

		return lastColumn;
	};
	const isBlankContent = (buffer, row, startColumn, endColumn) => {
		const line = buffer.lineForRow(row);
		const content = line.substring(startColumn, endColumn);
		const isBlank = content.trim() === "";

		return isBlank;
	};

	const range = editor.getSelectedBufferRange();
	const buffer = editor.getBuffer();
	let { start, end } = range;

	while (start.row < end.row) {
		if (isBlankContent(buffer, start.row, start.column)) {
			start.row++;
			start.column = 0;
		} else if (isBlankContent(buffer, end.row, 0, end.column)) {
			end.row--;
			end.column = lastColumnInRow(buffer, end.row);
		} else {
			break;
		}
	}

	return range;
};

const tooltipOptions = {
	title: "Add a comment"
};

export default class AddCommentPopupManager {
	markers = new Map();
	subscriptions = new CompositeDisposable();

	constructor(repoPath) {
		this.repoDirectory = new Directory(repoPath);

		this.subscriptions.add(
			atom.commands.add("atom-workspace", "codestream:comment", {
				didDispatch: () => this.onSelected(),
				hiddenInCommandPalette: true
			}),
			atom.workspace.observeActiveTextEditor(editor => {
				if (
					editor &&
					!this.markers.has(editor.id) &&
					this.repoDirectory.contains(editor.getPath())
				) {
					const marker = this.createMarker(editor);
					this.markers.set(editor.id, marker);

					this.subscriptions.add(
						editor.onDidDestroy(() => this.markers.delete(editor.id)),
						editor.onDidChangeSelectionRange(event =>
							this.handleChangeSelection(editor, marker, event)
						),
						marker.onDidDestroy(() => {
							// decoration will be destroyed automatically
							const { tooltip } = marker.getProperties();
							tooltip && tooltip.dispose();
						})
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
		let tooltip = atom.tooltips.add(item, tooltipOptions);
		item.onclick = this.onSelected;
		marker.setProperties({ item, tooltip });
		return marker;
	}

	handleChangeSelection(editor, marker, event) {
		const selectedLength = editor.getSelectedText().length;

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
			marker.setBufferRange(startRange);
			marker.setProperties({ decoration });
		} else {
			this.hideMarker(marker);
		}
	}

	hideMarker(marker) {
		const { decoration } = marker.getProperties();
		decoration && decoration.destroy();
	}

	onSelected = () => {
		const editor = atom.workspace.getActiveTextEditor();
		// if a marker doesn't exist for this editor, assume it's not valid
		if (!editor || !this.markers.has(editor.id)) return;

		this.publishSelection(editor);

		const marker = this.markers.get(editor.id);
		this.hideMarker(marker);

		const { item, tooltip } = marker.getProperties();
		// destroying the decoration leaks the tooltip, so it needs to be destroyed and recreated
		tooltip.dispose();
		marker.setProperties({ tooltip: atom.tooltips.add(item, tooltipOptions) });
	};

	publishSelection(editor) {
		const range = trimSelection(editor);
		let code = editor.getTextInBufferRange(range);
		// preContext is the 10 lines of code immediately preceeding the selection
		let preContext = editor.getTextInBufferRange([
			[range.start.row - 10, 0],
			[range.start.row, range.start.column]
		]);
		// postContext is the 10 lines of code immediately following the selection
		let postContext = editor.getTextInBufferRange([
			[range.end.row, range.end.column],
			[range.end.row + 10, 0]
		]);

		// if there is no selected text, i.e. it is a 0-width range,
		// then grab the current line of code that the cursor is on
		if (code.length == 0 && range.start.row == range.end.row) {
			let lineRange = [[range.start.row, 0], [range.start.row, 10000]];
			code = editor.getTextInBufferRange(lineRange);
		}

		atom.project.repositoryForDirectory(this.repoDirectory).then(async repo => {
			if (repo) {
				let authors = [];
				try {
					let blamer = this.blamer || (this.blamer = new Blamer(repo));
					authors = await blamer.blame(editor.getPath(), range);
				} catch (e) {
					console.error("Unable to blame", e);
				} finally {
					window.parent.postMessage(
						{
							type: "codestream:interaction:code-highlighted",
							body: {
								authors,
								quoteRange: range,
								quoteText: code,
								preContext: preContext,
								postContext: postContext
							}
						},
						"*"
					);
				}
			}
		});
	}

	destroy() {
		this.subscriptions.dispose();
		this.markers.forEach(marker => marker.destroy());
	}
}
