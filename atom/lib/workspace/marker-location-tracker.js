// @flow
import { CompositeDisposable, TextEditor } from "atom";
import type { Resource } from "../types/codestream";

export default class MarkerLocationTracker implements Resource {
	subscriptions = new CompositeDisposable();
	observedEditors: Map<number, TextEditor> = new Map();

	constructor() {
		this.subscriptions.add(
			atom.workspace.observeActiveTextEditor((editor: ?TextEditor) => {
				if (editor && !this.observedEditors.has(editor.id)) {
					const id = editor.id;
					this.observedEditors.set(id, editor);
					this.subscriptions.add(
						editor.onDidDestroy(() => this.observedEditors.delete(id)),
						editor.getBuffer().onDidReload(() => this.calculateLocations(editor)),
						editor.onDidStopChanging(() => this.calculateLocations(editor))
					);
				}
			})
		);
	}

	calculateLocations(editor: TextEditor) {
		console.debug("should calculate locations for", editor.getPath());
	}

	destroy() {
		this.subscriptions.dispose();
		this.observedEditors.clear();
	}
}
