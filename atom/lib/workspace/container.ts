import { MarkerDecorationProvider } from "./marker-decoration-provider";

export class Container {
	private static _markerDecorationProvider: MarkerDecorationProvider;
	static get markerDecorationProvider() {
		return this._markerDecorationProvider;
	}

	static initialize(markerDecorationProvider: MarkerDecorationProvider) {
		this._markerDecorationProvider = markerDecorationProvider;
		return;
	}
}
