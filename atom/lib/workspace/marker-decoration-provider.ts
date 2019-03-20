import { DocumentMarker, DocumentMarkersRequestType } from "@codestream/protocols/agent";
import { CompositeDisposable, DisplayMarker, Disposable, Gutter, TextEditor } from "atom";
import { Convert } from "atom-languageclient";
import { accessSafely, asAbsolutePath, Editor } from "utils";
import { ViewController } from "views/controller";
import { SessionStatus, WorkspaceSession } from "./workspace-session";

interface DefaultCreator<K = any, V = any> {
	(key: K): V;
}

class MapWithDefaults<K, V> extends Map<K, V> {
	private createDefault: DefaultCreator<K, V>;

	constructor(createDefault: DefaultCreator, entries?: ReadonlyArray<[K, V]>) {
		super(entries);
		this.createDefault = createDefault;
	}

	get(key: K): V {
		let value = super.get(key);
		if (value) return value;

		value = this.createDefault(key);
		this.set(key, value);
		return value;
	}
}

export class MarkerDecorationProvider implements Disposable {
	private subscriptions: CompositeDisposable;
	private observedEditors: Map<number, TextEditor> = new Map();
	private gutters: Map<number, Gutter> = new Map();
	private session: WorkspaceSession;
	private viewController: ViewController;
	private markers = new MapWithDefaults<number, DisplayMarker[]>(() => []);
	private editorResources = new MapWithDefaults<number, CompositeDisposable>(
		() => new CompositeDisposable()
	);
	private sessionSubscriptions = new CompositeDisposable();

	constructor(session: WorkspaceSession, viewController: ViewController) {
		this.session = session;
		this.viewController = viewController;

		this.subscriptions = new CompositeDisposable(
			session.observeSessionStatus(status => {
				switch (status) {
					case SessionStatus.SignedOut: {
						this.reset();
						break;
					}
					case SessionStatus.SignedIn: {
						if (session.configManager.get("showMarkers")) this.initialize();
						break;
					}
				}
			}),
			session.configManager.onDidChange("showMarkers", ({ newValue }) =>
				newValue === true ? this.initialize() : this.reset()
			)
		);
	}

	initialize() {
		this.sessionSubscriptions.add(
			atom.workspace.observeActiveTextEditor(this.onActiveEditor),
			this.session.agent.onDidChangeDocumentMarkers(({ textDocument }) => {
				for (const editor of this.observedEditors.values()) {
					if (Editor.getUri(editor) === textDocument.uri) {
						this.provideFor(editor);
						break;
					}
				}
			})
		);
	}

	private onActiveEditor = (editor?: TextEditor) => {
		if (editor && editor.getPath() && !this.observedEditors.has(editor.id)) {
			const id = editor.id;
			this.observedEditors.set(id, editor);
			this.provideFor(editor);
			const resources = this.editorResources.get(editor.id);
			resources.add(
				editor.onDidDestroy(() => {
					this.observedEditors.delete(id);
					resources.dispose();
				})
			);
		}
	}

	private async provideFor(editor: TextEditor) {
		const response = await this.session.agent.request(DocumentMarkersRequestType, {
			textDocument: { uri: Convert.pathToUri(editor.getPath()!) },
		});

		if (response && response.markers) {
			if (this.editorResources.has(editor.id)) {
				this.editorResources.get(editor.id).dispose();
			}

			this.editorResources.set(
				editor.id,
				new CompositeDisposable(
					...response.markers.map(docMarker => this.decorate(editor, docMarker))
				)
			);
		}
	}

	private getGutter(editor: TextEditor): Gutter {
		let gutter = this.gutters.get(editor.id);
		if (!gutter) {
			gutter = editor.addGutter({
				name: `codestream-${editor.id}`,
			});
			this.editorResources.get(editor.id).add(
				gutter.onDidDestroy(() => {
					this.gutters.delete(editor.id);
				})
			);
			this.gutters.set(editor.id, gutter);
		}
		return gutter;
	}

	private decorate(editor: TextEditor, docMarker: DocumentMarker) {
		const marker = editor.markBufferRange(Convert.lsRangeToAtomRange(docMarker.range), {
			invalidate: "never",
		});
		this.markers.get(editor.id).push(marker);

		let color = docMarker.codemark.color;
		color = color === "none" ? "" : `-${color}`;

		const iconPath = Convert.pathToUri(
			asAbsolutePath(`dist/icons/marker-${docMarker.codemark.type}${color}.svg`)
		);

		const img = document.createElement("img");
		img.src = iconPath;

		const item = document.createElement("div");
		item.onclick = event => {
			event.preventDefault();
			this.viewController.getMainView().show(docMarker.postStreamId, docMarker.postId);
		};
		item.classList.add("codemark");
		item.appendChild(img);

		const gutter = this.getGutter(editor);
		gutter.decorateMarker(marker, { item });

		const tooltip = atom.tooltips.add(img, {
			title: `${docMarker.creatorName}: ${docMarker.summary}`,
			placement: "right",
		});

		return new CompositeDisposable(
			tooltip,
			new Disposable(() => {
				marker.destroy();
				item.remove();
			}),
			marker.onDidDestroy(() => {
				const markers = this.markers.get(editor.id);
				this.markers.set(editor.id, markers.filter(m => m.isDestroyed() === false));
			})
		);
	}

	reset() {
		this.observedEditors.clear();
		this.gutters.forEach(gutter => accessSafely(() => gutter.destroy()));
		this.gutters.clear();
		this.markers.forEach(markers =>
			markers.forEach(marker => accessSafely(() => marker.destroy()))
		);
		this.markers.clear();
		this.editorResources.forEach(r => r.dispose());
		this.editorResources.clear();
		this.sessionSubscriptions.dispose();
		this.sessionSubscriptions = new CompositeDisposable();
	}

	dispose() {
		this.reset();
		this.subscriptions.dispose();
	}
}
