import { ChangeDataType, DocumentMarkersRequestType } from "@codestream/protocols/agent";
import { CompositeDisposable, DisplayMarker, Disposable, Gutter, TextEditor } from "atom";
import { Convert } from "atom-languageclient";
import { accessSafely, asAbsolutePath, Editor } from "utils";
import { ViewController } from "views/controller";
import { SessionStatus, WorkspaceSession } from "./workspace-session";

export class MarkerDecorationProvider implements Disposable {
	private resourceSubscriptions = new CompositeDisposable();
	private subscriptions = new CompositeDisposable();
	private observedEditors: Map<number, TextEditor> = new Map();
	private gutters: Map<number, Gutter> = new Map();
	private markers: Map<number, DisplayMarker[]> = new Map();
	private sessionStatus: SessionStatus;
	private session: WorkspaceSession;
	private viewController: ViewController;

	constructor(session: WorkspaceSession, viewController: ViewController) {
		this.session = session;
		this.viewController = viewController;
		this.sessionStatus = session.status;

		if (session.configManager.get("showMarkers")) this.initialize();
		this.subscriptions.add(
			session.configManager.onDidChange("showMarkers", ({ newValue }) =>
				newValue ? this.initialize() : this.reset()
			)
		);
	}

	initialize() {
		this.subscriptions.add(
			this.session.onDidChangeSessionStatus(status => {
				switch (status) {
					case SessionStatus.SignedOut: {
						if (this.sessionStatus !== SessionStatus.SignedOut) {
							this.sessionStatus = status;
							this.reset();
							this.initialize();
							this.resourceSubscriptions = new CompositeDisposable();
						}
						break;
					}
					case SessionStatus.SignedIn: {
						this.sessionStatus = status;
						this.resourceSubscriptions.add(
							atom.workspace.observeActiveTextEditor(this.onActiveEditor)
						);
					}
				}
			}),
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
			this.resourceSubscriptions.add(editor.onDidDestroy(() => this.observedEditors.delete(id)));
		}
	}

	private async provideFor(editor: TextEditor) {
		let gutter = this.gutters.get(editor.id);
		if (!gutter) {
			gutter = editor.addGutter({
				name: `codestream-${editor.id}`,
			});
			this.resourceSubscriptions.add(
				gutter.onDidDestroy(() => {
					this.gutters.delete(editor.id);
				})
			);
			this.gutters.set(editor.id, gutter);
		}

		const response = await this.session.agent.request(DocumentMarkersRequestType, {
			textDocument: { uri: Convert.pathToUri(editor.getPath()!) },
		});

		if (response && response.markers) {
			response.markers.forEach(docMarker => {
				const marker = editor.markBufferRange(Convert.lsRangeToAtomRange(docMarker.range), {
					invalidate: "never",
				});

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
				gutter!.decorateMarker(marker, { item });

				const tooltip = atom.tooltips.add(img, {
					title: `${docMarker.creatorName}: ${docMarker.summary}`,
					placement: "right",
				});
				this.resourceSubscriptions.add(
					tooltip,
					new Disposable(() => {
						marker.destroy();
						item.remove();
					}),
					marker.onDidDestroy(() => this.markers.delete(editor.id))
				);
			});
		}
	}

	reset() {
		this.observedEditors.clear();
		this.gutters.forEach(gutter => accessSafely(() => gutter.destroy()));
		this.gutters.clear();
		this.markers.forEach(markers =>
			markers.forEach(marker => accessSafely(() => marker.destroy()))
		);
		this.markers.clear();
		this.resourceSubscriptions.dispose();
	}

	dispose() {
		this.reset();
		this.subscriptions.dispose();
	}
}
