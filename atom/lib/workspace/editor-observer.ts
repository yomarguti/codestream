import { CompositeDisposable, Disposable, Emitter, Point, Range, TextEditor } from "atom";
import { throttle } from "utils";

const DID_CHANGE_SELECTION = "did-change-selection";
const DID_CHANGE_EDITOR = "did-change-editor";
const DID_CHANGE_VISIBLE_RANGES = "did-change-visible-ranges";

export class WorkspaceEditorObserver implements Disposable {
	private subscriptions: CompositeDisposable;
	private emitter = new Emitter();
	private highlights = new Map<number, Disposable>();

	constructor() {
		this.subscriptions = new CompositeDisposable();
		this.subscriptions.add(
			atom.workspace.observeActiveTextEditor(editor => {
				this.emitter.emit(DID_CHANGE_EDITOR, editor);
				if (editor) {
					const editorSubscriptions = new CompositeDisposable(
						editor.observeSelections(selection => {
							const callback = throttle(event => {
								if (
									!event.newBufferRange.isEqual(event.oldBufferRange) &&
									!event.newBufferRange.isEmpty()
								) {
									this.emitter.emit(DID_CHANGE_SELECTION, {
										editor,
										range: event.selection.getBufferRange(),
										cursor: editor.getCursorBufferPosition(),
									});
								}
							});
							selection.onDidChangeRange(callback);
							selection.onDidDestroy(() => {
								callback.cancel();
							});
						}),
						editor.onDidDestroy(() => editorSubscriptions.dispose())
					);
					const editorView = atom.views.getView(editor);
					if (editorView) {
						editorSubscriptions.add(
							editorView.onDidChangeScrollTop(() => {
								this.emitter.emit(DID_CHANGE_VISIBLE_RANGES, editor);
							})
						);
					}
					this.subscriptions.add(editorSubscriptions);
				}
			})
		);
	}

	onDidChangeSelection(
		cb: (event: { editor: TextEditor; range: Range; cursor: Point }) => void
	): Disposable {
		return this.emitter.on(DID_CHANGE_SELECTION, cb);
	}

	onDidChangeActiveEditor(cb: (editor?: TextEditor) => void): Disposable {
		return this.emitter.on(DID_CHANGE_EDITOR, cb);
	}

	onDidChangeVisibleRanges(cb: (editor: TextEditor) => void) {
		return this.emitter.on(DID_CHANGE_VISIBLE_RANGES, cb);
	}

	async highlight(enable: boolean, file: string, range: Range) {
		const editor = (await atom.workspace.open(file)) as TextEditor | undefined;
		if (editor) {
			if (enable) {
				// editor.setCursorBufferPosition(range.start);
				editor.scrollToBufferPosition(range.start, {
					center: true,
				});
				const marker = editor.markBufferRange(range, {
					invalidate: "never",
				});
				editor.decorateMarker(marker, {
					type: "highlight",
					class: "codestream-highlight",
				});

				this.highlights.set(
					(marker as any).id,
					new CompositeDisposable(
						new Disposable(() => {
							marker.destroy();
						}),
						editor.onDidChangeSelectionRange(() => this.removeHighlight((marker as any).id))
					)
				);
			} else {
				const markers = editor.findMarkers({
					startBufferRow: range.start.row,
				});
				markers.forEach(marker => {
					this.removeHighlight((marker as any).id);
				});
			}
		}
	}

	private removeHighlight(markerId: number) {
		const disposable = this.highlights.get(markerId);
		disposable && disposable.dispose();
	}

	dispose() {
		this.subscriptions.dispose();
		this.emitter.dispose();
		this.highlights.forEach(highlight => highlight.dispose());
	}
}
