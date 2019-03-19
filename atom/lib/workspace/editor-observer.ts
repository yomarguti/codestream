import { CompositeDisposable, Disposable, Emitter, Point, Range, TextEditor } from "atom";
import { throttle } from "utils";

const DID_CHANGE_SELECTION = "did-change-selection";
const DID_CHANGE_EDITOR = "did-change-editor";

export class WorkspaceEditorObserver implements Disposable {
	private subscriptions: CompositeDisposable;
	private emitter = new Emitter();
	private _disposed = false;
	get disposed() {
		return this._disposed;
	}

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

	dispose() {
		this.subscriptions.dispose();
		this.emitter.dispose();
		this._disposed = true;
	}
}
