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

export default class AddCommentPopupManager {
	editors = new Map();
	markers = new Map();
	subscriptions = new CompositeDisposable();

	constructor(repoPath) {
		this.repoDirectory = new Directory(repoPath);

		this.subscriptions.add(
			atom.workspace.observeActiveTextEditor(editor => {
				if (
					editor &&
					!this.editors.has(editor.id) &&
					this.repoDirectory.contains(editor.getPath())
				) {
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
		let tooltip = atom.tooltips.add(item, {
			title: "Add a comment"
		});
		item.onclick = () => {
			this.publishSelection(editor);
			marker.getProperties().decoration.destroy();
			tooltip.dispose();
			tooltip = atom.tooltips.add(item, {
				title: "Add a comment"
			});
		};
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

	publishSelection(editor) {
		var range = trimSelection(editor);
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

		atom.project.repositoryForDirectory(this.repoDirectory).then(repo => {
			if (repo) {
				// TODO: refactor Blamer and tune it to return authors for a range
				new Blamer(repo).blame(editor.getPath(), (err, data) => {
					if (!err) {
						window.parent.postMessage(
							{
								type: "codestream:interaction:code-highlighted",
								body: {
									quoteRange: range,
									quoteText: code,
									preContext: preContext,
									postContext: postContext,
									authors: this.getAuthors(range, data)
								}
							},
							"*"
						);
					}
				});
			}
		});
	}

	getAuthors(selectionRange, gitData) {
		const authors = [];
		for (var lineNum = selectionRange.start.row; lineNum <= selectionRange.end.row; lineNum++) {
			var lineData = gitData[lineNum - 1];
			if (lineData) {
				const authorEmail = lineData["email"];
				if (authorEmail && authorEmail !== "not.committed.yet") {
					if (!authors.includes(authorEmail)) authors.push(authorEmail);
				}
			}
		}

		return authors;
	}

	destroy() {
		this.subscriptions.dispose();
		this.editors.clear();
		this.markers.clear();
	}
}
