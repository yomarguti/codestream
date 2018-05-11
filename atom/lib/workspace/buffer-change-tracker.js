import { CompositeDisposable, Directory } from "atom";
import { locationToRange } from "../util/Marker";

export default class BufferChangeTracker {
	subscriptions = new CompositeDisposable();
	listeners = new Map();

	constructor(store, repoPath) {
		this.store = store;
		this.repoDirectory = new Directory(repoPath);
		this.initialize();
	}

	async initialize() {
		window.addEventListener("message", this.handleMessage, true);
		this.repo = await atom.project.repositoryForDirectory(this.repoDirectory);

		this.subscriptions.add(
			atom.workspace.observeActiveTextEditor(editor => {
				if (editor && this.repoDirectory.contains(editor.getPath())) {
					this.publish(editor); // publish to existing listeners
					this.subscriptions.add(editor.onDidStopChanging(_event => this.publish(editor)));
				}
			})
		);
	}

	handleMessage = ({ data }) => {
		if (data.type === "codestream:subscription:file-changed") {
			const codeBlock = data.body;
			const listenersForFile = this.listeners.get(codeBlock.file) || [];
			this.listeners.set(codeBlock.file, [...listenersForFile, codeBlock]);
			this.publish(atom.workspace.getActiveTextEditor()); // Publish the current status
		}
	};

	publish = editor => {
		const listeners = this.listeners.get(this.repo.relativize(editor.getPath()));
		if (listeners) {
			const { context, markerLocations } = this.store.getState();
			const locationsByMarkerId = markerLocations.byCommit[context.currentCommit] || {};
			listeners.forEach(codeBlock => {
				const existingCode = editor.getTextInBufferRange(
					locationToRange(locationsByMarkerId[codeBlock.markerId])
				);
				window.parent.postMessage(
					{
						type: "codestream:publish:file-changed",
						body: { file: codeBlock.file, hasDiff: existingCode !== codeBlock.code }
					},
					"*"
				);
			});
		}
	};

	destroy() {
		this.subscriptions.dispose();
		window.removeEventListener("message", this.handleMessage, true);
	}
}
