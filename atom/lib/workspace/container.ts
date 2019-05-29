import { ConfigManager } from "configs";
import { PackageState } from "types/package";
import { ViewController } from "views/controller";
import { StylesProvider } from "views/styles-getter";
import { EditorManipulator } from "./editor-manipulator";
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

	private static _styles: StylesProvider;
	static get styles() {
		return this._styles;
	}

	private static _editorManipulator: EditorManipulator;
	static get editorManipulator() {
		return this._editorManipulator;
	}

	static initialize(state: PackageState) {
		this._configs = new ConfigManager();
		this._styles = StylesProvider.create();
		this._editorManipulator = new EditorManipulator();
		this._session = WorkspaceSession.create(state);
		this._viewController = new ViewController(this._session, state.views);
		this._markerDecorationProvider = new MarkerDecorationProvider(
			this.session,
			this._viewController
		);
	}
}
