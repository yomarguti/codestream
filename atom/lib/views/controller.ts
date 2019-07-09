import { CompositeDisposable, Disposable, Dock, WorkspaceCenter, WorkspaceItem } from "atom";
import { WorkspaceSession } from "workspace/workspace-session";
import { CODESTREAM_VIEW_URI, CodestreamView } from "./codestream-view";

export function isViewVisible(uri: string) {
	const container = atom.workspace.paneContainerForURI(uri);
	if (container) {
		const activeItem = container.getActivePaneItem() as WorkspaceItem | undefined;
		if (!activeItem) return false;
		const viewIsActive = activeItem.getURI && activeItem.getURI() === uri;
		if (isDock(container)) {
			return container.isVisible() && viewIsActive;
		}
		return viewIsActive;
	}
	return false;
}

export interface ViewsState {
	[CODESTREAM_VIEW_URI]: {
		state: any;
	};
}

const initialViewState: ViewsState = {
	[CODESTREAM_VIEW_URI]: { state: {} },
};

const containers = [
	atom.workspace.getCenter(),
	atom.workspace.getLeftDock(),
	atom.workspace.getRightDock(),
	atom.workspace.getBottomDock(),
];

function isDock(container: Dock | WorkspaceCenter): container is Dock {
	return (container as any).getLocation() !== "center";
}

export class ViewController implements Disposable {
	private subscriptions = new CompositeDisposable();
	private mainView?: CodestreamView;

	constructor(private session: WorkspaceSession, private viewState = initialViewState) {
		this.subscriptions.add(
			atom.workspace.addOpener(uri => this.getView(uri)),
			atom.commands.add("atom-workspace", "codestream:toggle", () =>
				atom.workspace.toggle(CODESTREAM_VIEW_URI)
			)
		);
		containers.map(container => {
			this.subscriptions.add(
				container.onDidStopChangingActivePaneItem((_item: WorkspaceItem) => {
					if (this.mainView) this.mainView.checkToToggleMarkers();
				})
			);
			if (isDock(container)) {
				this.subscriptions.add(
					container.onDidChangeVisible(_visible => {
						if (this.mainView) this.mainView.checkToToggleMarkers();
					})
				);
			}
		});
	}

	getMainView() {
		if (this.mainView) return this.mainView;
		this.mainView = new CodestreamView(this.session, this.viewState[CODESTREAM_VIEW_URI].state);
		this.subscriptions.add(
			this.mainView.onDidChangeState(state => {
				this.viewState[CODESTREAM_VIEW_URI] = { state };
			}),
			this.mainView.onWillDestroy(() => (this.mainView = undefined))
		);

		return this.mainView;
	}

	getView(uri: string) {
		if (uri === CODESTREAM_VIEW_URI) {
			return this.getMainView();
		}
	}

	destroyView(uri: string) {
		if (this.mainView && this.mainView.getURI() === uri) {
			const pane = atom.workspace.paneForURI(uri);
			if (pane !== undefined) {
				pane.destroy();
			}
		}
	}

	reload(uri: string) {
		const paneForItem = atom.workspace.paneForURI(uri);
		if (!paneForItem) return;

		const item = paneForItem.itemForURI(uri) as WorkspaceItem | undefined;
		if (!item) return;

		item.destroy && item.destroy();

		if (this.viewState[uri]) {
			this.viewState[uri].state = undefined;
		}
		const disposable = paneForItem.onDidRemoveItem(e => {
			if (e.item === item) {
				atom.workspace.toggle(uri);
				disposable.dispose();
			}
		});
		paneForItem.destroyItem(item);
	}

	serialize() {
		return this.viewState;
	}

	dispose() {
		this.subscriptions.dispose();
		this.mainView && this.destroyView(this.mainView.getURI());
	}
}
