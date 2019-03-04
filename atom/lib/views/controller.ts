import { WorkspaceSession } from "workspace/workspace-session";
import { CodestreamView, CODESTREAM_VIEW_URI } from "./codestream-view";
import { Disposable, CompositeDisposable } from "atom";

export class ViewController implements Disposable {
	private subscriptions = new CompositeDisposable();
	private mainView?: CodestreamView;
	private mainViewData: any;

	constructor(private session: WorkspaceSession) {
		this.subscriptions.add(
			atom.workspace.addOpener(uri => this.getView(uri)),
			atom.commands.add("atom-workspace", "codestream:toggle", () =>
				atom.workspace.toggle(CODESTREAM_VIEW_URI)
			)
		);
	}

	getMainView() {
		if (this.mainView) return this.mainView;
		this.mainView = new CodestreamView(this.session, this.mainViewData);
		this.mainView.onWillDestroy(data => {
			this.mainView = undefined;
			this.mainViewData = data;
		});

		return this.mainView;
	}

	getView(uri: string) {
		if (uri === CODESTREAM_VIEW_URI) {
			return this.getMainView();
		}
	}

	dispose() {
		this.subscriptions.dispose();
		this.mainView && this.mainView.destroy();
	}
}
