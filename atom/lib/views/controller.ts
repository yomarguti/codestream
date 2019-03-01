import { WorkspaceSession } from "workspace/workspace-session";
import { CodestreamView, CODESTREAM_VIEW_URI } from "./codestream-view";
import { Disposable, CompositeDisposable } from "atom";

export class ViewController implements Disposable {
	private subscriptions = new CompositeDisposable();
	private mainView?: CodestreamView;

	constructor(private session: WorkspaceSession) {
		this.subscriptions.add(
			atom.workspace.addOpener(uri => this.getView(uri)),
			atom.commands.add("atom-workspace", "codestream:toggle", () =>
				atom.workspace.toggle(CODESTREAM_VIEW_URI)
			)
		);
	}

	getMainView() {
		if (this.mainView && this.mainView.alive) return this.mainView;
		this.mainView = new CodestreamView(this.session);

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
