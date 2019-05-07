import { ConfigManager } from "configs";
import { PackageState } from "types/package";
import { ViewController } from "views/controller";
import { MarkerDecorationProvider } from "./marker-decoration-provider";
import { WorkspaceSession } from "./workspace-session";

export class Container {
	private static _markerDecorationProvider: MarkerDecorationProvider;
	static get markerDecorationProvider() {
		return this._markerDecorationProvider;
	}

	private static _configs: ConfigManager;
	static get configs() {
		return this._configs;
	}

	private static _session: WorkspaceSession;
	static get session() {
		return this._session;
	}

	private static _viewController: ViewController;
	static get viewController() {
		return this._viewController;
	}

	static initialize(state: PackageState) {
		this._configs = new ConfigManager();
		this._session = WorkspaceSession.create(state, this.configs.get("autoSignIn"));
		this._viewController = new ViewController(this._session, state.views);
		this._markerDecorationProvider = new MarkerDecorationProvider(
			this.session,
			this._viewController
		);
	}
}
