import { CompositeDisposable, Disposable } from "atom";
import { WorkspaceSession } from "workspace/workspace-session";
import { CODESTREAM_VIEW_URI, CodestreamView } from "./codestream-view";

export interface ViewsState {
	[CODESTREAM_VIEW_URI]: {
		state: any;
	};
}

const initialViewState: ViewsState = {
	[CODESTREAM_VIEW_URI]: { state: {} },
};

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

	serialize() {
		return this.viewState;
	}

	dispose() {
		this.subscriptions.dispose();
		this.mainView && this.mainView.destroy();
	}
}
