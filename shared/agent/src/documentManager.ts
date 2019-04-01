"use strict";
import { CodeStreamAgent } from "agent";
import {
	Disposable,
	TextDocument,
	TextDocumentChangeEvent,
	TextDocuments
} from "vscode-languageserver";
import URI from "vscode-uri";
import { DidChangeDocumentMarkersNotificationType } from "./protocol/agent.protocol";
import { Disposables } from "./system";

const escapedRegex = /(^.*?:\/\/\/)([a-z])%3A(\/.*$)/;
const unescapedRegex = /(^.*?:\/\/\/)([a-zA-Z]):(\/.*$)/;

export class DocumentManager implements Disposable {
	private readonly _disposable: Disposable;
	private readonly _isWindows: boolean;

	private readonly _normalizedUriLookup = new Map<string, string>();

	constructor(
		private readonly _documents: TextDocuments,
		private readonly _agent: CodeStreamAgent
	) {
		this._isWindows = process.platform === "win32";

		this._disposable = Disposables.from(
			// this._documents.onDidOpen(this.onOpened),
			this._documents.onDidChangeContent(this.onContentChanged)
		);

		this._documents.listen(_agent.connection);
	}

	dispose() {
		this._disposable && this._disposable.dispose();
	}

	private onContentChanged = (e: TextDocumentChangeEvent) => {
		this._agent.sendNotification(DidChangeDocumentMarkersNotificationType, {
			textDocument: { uri: URI.parse(e.document.uri).toString() },
			reason: "document"
		});
	}

	// private onOpened(e: TextDocumentChangeEvent) {}

	get(uri: string): TextDocument | undefined {
		if (!this._isWindows) {
			return this._documents.get(uri);
		}

		// If we are on windows we have to do some drive letter manipulation to support different editor using different uri formatting
		const key = this._normalizedUriLookup.get(uri);
		if (key !== undefined) {
			return this._documents.get(key);
		}

		let doc = this._documents.get(uri);
		if (doc !== undefined) return doc;

		let match = unescapedRegex.exec(uri);
		if (match != null) {
			const escapedUri = uri.replace(unescapedRegex, function(
				_,
				start: string,
				drive: string,
				end: string
			) {
				return `${start}${drive.toLowerCase()}%3A${end}`;
			});
			doc = this._documents.get(escapedUri);
			if (doc !== undefined) {
				this._normalizedUriLookup.set(uri, doc.uri);
			}

			return doc;
		}

		match = escapedRegex.exec(uri);
		if (match != null) {
			let unescapedUri = uri.replace(escapedRegex, function(
				_,
				start: string,
				drive: string,
				end: string
			) {
				return `${start}${drive.toUpperCase()}:${end}`;
			});
			doc = this._documents.get(unescapedUri);
			if (doc !== undefined) {
				this._normalizedUriLookup.set(uri, doc.uri);

				return doc;
			}

			unescapedUri = uri.replace(escapedRegex, function(start, drive: string, end) {
				return `${start}${drive.toLowerCase()}:${end}`;
			});
			doc = this._documents.get(unescapedUri);
			if (doc !== undefined) {
				this._normalizedUriLookup.set(uri, doc.uri);
			}

			return doc;
		}

		return undefined;
	}
}
