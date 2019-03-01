import { Disposable, CompositeDisposable, TextEditor, Gutter, DisplayMarker } from "atom";
import { WorkspaceSession, SessionStatus } from "./workspace-session";
import { DocumentMarkersRequestType } from "@codestream/protocols/agent";
import { Convert } from "atom-languageclient";
import { asAbsolutePath, accessSafely } from "utils";
import { ViewController } from "views/controller";

export class MarkerDecorationProvider implements Disposable {
	private subscriptions = new CompositeDisposable();
	private observedEditors: Map<number, TextEditor> = new Map();
	private gutters: Map<number, Gutter> = new Map();
	private markers: Map<number, DisplayMarker[]> = new Map();
	private sessionStatus: SessionStatus;
	private sessionStatusSubscription: Disposable;
	private session: WorkspaceSession;
	private viewController: ViewController;

	constructor(session: WorkspaceSession, viewController: ViewController) {
		this.session = session;
		this.viewController = viewController;
		this.sessionStatus = session.status;
		this.sessionStatusSubscription = this.session.onDidChangeSessionStatus(status => {
			switch (status) {
				case SessionStatus.SignedOut: {
					if (this.sessionStatus !== SessionStatus.SignedOut) {
						this.sessionStatus = status;
						this.reset();
						this.subscriptions = new CompositeDisposable();
					}
					break;
				}
				case SessionStatus.SignedIn: {
					this.sessionStatus = status;
					this.subscriptions.add(atom.workspace.observeActiveTextEditor(this.onActiveEditor));
				}
			}
		});
	}

	private onActiveEditor = (editor?: TextEditor) => {
		if (editor && editor.getPath() && !this.observedEditors.has(editor.id)) {
			const id = editor.id;
			this.observedEditors.set(id, editor);
			this.provideFor(editor);
			this.subscriptions.add(editor.onDidDestroy(() => this.observedEditors.delete(id)));
		}
	};

	private async provideFor(editor: TextEditor) {
		let gutter = this.gutters.get(editor.id);
		if (!gutter) {
			gutter = editor.addGutter({
				name: `codestream-${editor.id}`,
			});
			this.subscriptions.add(
				gutter.onDidDestroy(() => {
					this.gutters.delete(editor.id);
				})
			);
			this.gutters.set(editor.id, gutter);

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
					this.subscriptions.add(
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
	}

	reset() {
		this.observedEditors.clear();
		this.gutters.forEach(gutter => accessSafely(() => gutter.destroy()));
		this.gutters.clear();
		this.markers.forEach(markers =>
			markers.forEach(marker => accessSafely(() => marker.destroy()))
		);
		this.markers.clear();
		this.subscriptions.dispose();
	}

	dispose() {
		this.reset();
		this.sessionStatusSubscription.dispose();
	}
}
