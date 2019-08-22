"use strict";
import { commands, Disposable, Uri, UriHandler, window } from "vscode";
import { Container } from "./container";

export class ProtocolHandler implements UriHandler {
	private disposable: Disposable;

	constructor() {
		this.disposable = window.registerUriHandler(this);
	}

	async handleUri(uri: Uri) {
		await Container.webview.handleProtocol(uri);
	}

	dispose(): void {
		this.disposable && this.disposable.dispose();
	}
}
