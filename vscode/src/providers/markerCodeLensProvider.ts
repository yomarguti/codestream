"use strict";
import {
	CancellationToken,
	CodeLens,
	CodeLensProvider,
	ConfigurationChangeEvent,
	Disposable,
	DocumentSelector,
	Event,
	EventEmitter,
	languages,
	TextDocument,
	Uri
} from "vscode";
import {
	Marker,
	SessionStatus,
	SessionStatusChangedEvent,
	TextDocumentMarkersChangedEvent
} from "../api/session";
import { OpenCodemarkCommandArgs } from "../commands";
import { MarkerStyle } from "../config";
import { configuration } from "../configuration";
import { Container } from "../container";
import { Logger } from "../logger";
import { Strings } from "../system";

export class CodemarkCodeLensProvider implements CodeLensProvider, Disposable {
	static selector: DocumentSelector = { scheme: "file" };

	private readonly _onDidChangeCodeLenses = new EventEmitter<void>();
	public get onDidChangeCodeLenses(): Event<void> {
		return this._onDidChangeCodeLenses.event;
	}

	private readonly _disposable: Disposable;
	private _enabledDisposable: Disposable | undefined;

	constructor() {
		this._disposable = Disposable.from(
			Container.session.onDidChangeSessionStatus(this.onSessionStatusChanged, this),
			configuration.onDidChange(this.onConfigurationChanged, this)
		);

		this.onConfigurationChanged(configuration.initializingChangeEvent);
	}

	dispose() {
		this._enabledDisposable && this._enabledDisposable.dispose();
		this._disposable && this._disposable.dispose();
	}

	private onConfigurationChanged(e: ConfigurationChangeEvent) {
		if (
			!configuration.changed(e, configuration.name("showMarkers").value) &&
			!configuration.changed(e, configuration.name("markerStyle").value)
		) {
			return;
		}

		this.ensure();
	}

	private onSessionStatusChanged(e: SessionStatusChangedEvent) {
		switch (e.getStatus()) {
			case SessionStatus.SignedOut:
				this.disable();
				break;

			case SessionStatus.SignedIn:
				this.ensure();
				break;
		}
	}

	private ensure() {
		if (!Container.config.showMarkers || Container.config.markerStyle !== MarkerStyle.CodeLens) {
			this.disable();

			return;
		}

		this.enable();
	}

	private disable() {
		if (this._enabledDisposable === undefined) return;

		this._onDidChangeCodeLenses.fire();
		this._enabledDisposable && this._enabledDisposable.dispose();
	}

	private enable() {
		if (this._enabledDisposable !== undefined) return;

		this._enabledDisposable = Disposable.from(
			languages.registerCodeLensProvider(CodemarkCodeLensProvider.selector, this),
			Container.session.onDidChangeTextDocumentMarkers(this.onMarkersChanged, this)
		);
	}

	private onMarkersChanged(e: TextDocumentMarkersChangedEvent) {
		this._onDidChangeCodeLenses.fire();
	}

	async provideCodeLenses(
		document: TextDocument,
		token: CancellationToken
	): Promise<CodeLens[] | null | undefined> {
		if (
			!Container.config.showMarkers ||
			Container.config.markerStyle !== MarkerStyle.CodeLens ||
			Container.session.status !== SessionStatus.SignedIn
		) {
			return [];
		}

		const markers = await this.getMarkers(document.uri);
		if (markers == null || markers.length === 0) return [];

		const lenses = markers.map<CodeLens>(m => {
			const args: OpenCodemarkCommandArgs = {
				codemarkId: m.id,
				streamThread: {
					id: m.postId,
					streamId: m.postStreamId
				}
			};

			return new CodeLens(m.range, {
				title: `// ${m.creatorName}: ${Strings.truncate(m.summary, 60)}`,
				command: "codestream.openCodemark",
				arguments: [args]
			});
		});
		return lenses;
	}

	private async getMarkers(uri: Uri) {
		try {
			const response = await Container.agent.markers.fetch(uri);
			if (response == null) return undefined;

			return response.markers.map(m => new Marker(Container.session, m));
		} catch (ex) {
			Logger.error(ex);
			return undefined;
		}
	}
}
