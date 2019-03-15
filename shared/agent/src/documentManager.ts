"use strict";
import {
	Connection,
	Disposable,
	TextDocument,
	TextDocumentChangeEvent,
	TextDocuments
} from "vscode-languageserver";
import { DidChangeDocumentMarkersNotificationType } from "./protocol/agent.protocol";
import { Disposables } from "./system";

export class DocumentManager implements Disposable {
	private readonly _disposable: Disposable;

	constructor(private readonly _documents: TextDocuments, private _connection: Connection) {
		this._disposable = Disposables.from(
			// this._documents.onDidOpen(this.onOpened),
			this._documents.onDidChangeContent(this.onContentChanged)
		);

		this._documents.listen(_connection);
	}

	dispose() {
		this._disposable && this._disposable.dispose();
	}

	private onContentChanged = (e: TextDocumentChangeEvent) => {
		this._connection.sendNotification(DidChangeDocumentMarkersNotificationType, {
			textDocument: { uri: e.document.uri }
		});
	}

	// private onOpened(e: TextDocumentChangeEvent) {}

	get(uri: string): TextDocument | undefined {
		return this._documents.get(uri);
	}
}
