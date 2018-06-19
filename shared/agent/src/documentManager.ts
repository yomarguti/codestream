"use strict";
import { Disposable, TextDocumentChangeEvent, TextDocuments } from "vscode-languageserver";
import { Container } from "./container";
import { Disposables } from "./system";

export class DocumentManager implements Disposable {
	private readonly _disposable: Disposable;
	private readonly _documents: TextDocuments;

	constructor() {
		this._documents = new TextDocuments();
		this._disposable = Disposables.from(this._documents.onDidChangeContent(this.onContentChanged));
	}

	dispose() {
		this._disposable && this._disposable.dispose();
	}

	private onContentChanged(e: TextDocumentChangeEvent) {}

	get(uri: string) {
		this._documents.get(uri);
	}

	listen() {
		this._documents.listen(Container.instance.connection);
	}
}
