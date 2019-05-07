import { ConfigManager } from "configs";
import { MarkerDecorationProvider } from "./marker-decoration-provider";

export class Container {
	private static _markerDecorationProvider: MarkerDecorationProvider;
	static get markerDecorationProvider() {
		return this._markerDecorationProvider;
	}

	private static _configs: ConfigManager;
	static get configs() {
		return this._configs;
	}

	static initialize(markerDecorationProvider: MarkerDecorationProvider, configs: ConfigManager) {
		this._markerDecorationProvider = markerDecorationProvider;
		this._configs = configs;
		return;
	}
}
