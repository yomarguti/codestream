"use strict";
import {
	Connection,
	Disposable,
	TextDocument,
	TextDocumentChangeEvent,
	TextDocuments
} from "vscode-languageserver";
import { Disposables } from "./system";

export class DocumentManager implements Disposable {
	private readonly _disposable: Disposable;
	private readonly _documents: TextDocuments;

	constructor() {
		this._documents = new TextDocuments();
		this._disposable = Disposables.from(
			this._documents.onDidOpen(this.onOpened),
			this._documents.onDidChangeContent(this.onContentChanged)
		);
	}

	dispose() {
		this._disposable && this._disposable.dispose();
	}

	private onContentChanged(e: TextDocumentChangeEvent) {}

	private onOpened(e: TextDocumentChangeEvent) {}

	get(uri: string): TextDocument | undefined {
		return this._documents.get(uri);
	}

	listen(conn: Connection) {
		this._documents.listen(conn);
	}
}
