"use strict";
import { isEqual as _isEqual } from "lodash-es";
import {
	Connection,
	Disposable,
	Emitter,
	Event,
	TextDocument,
	TextDocumentChangeEvent,
	TextDocuments
} from "vscode-languageserver";
import { URI } from "vscode-uri";
import { SessionContainer } from "./container";
import { Logger } from "./logger";
import { ChangeDataType, DidChangeDataNotificationType } from "./protocol/agent.protocol";
import { Disposables } from "./system";
const escapedRegex = /(^.*?:\/\/\/)([a-z])%3A(\/.*$)/;
const unescapedRegex = /(^.*?:\/\/\/)([a-zA-Z]):(\/.*$)/;

export class DocumentManager implements Disposable {
	private _onDidChangeContent = new Emitter<TextDocumentChangeEvent>();
	get onDidChangeContent(): Event<TextDocumentChangeEvent> {
		return this._onDidChangeContent.event;
	}

	private readonly _disposable: Disposable;
	private readonly _isWindows: boolean;

	private readonly _normalizedUriLookup = new Map<string, string>();
	// store an array of line offsets for each document's uri
	private readonly _savedContentCache: { [uri: string]: Number[] } = {};

	constructor(private readonly _documents: TextDocuments, connection: Connection) {
		this._isWindows = process.platform === "win32";

		this._disposable = Disposables.from(
			this._documents.onDidChangeContent(e => {
				this._onDidChangeContent.fire(e);
				// we're trying to see if we've changed content back to
				// the same state as it was when it was saved... therefore it's not dirty
				let isDirty = true;
				const offsets = this.getLineOffsets(e.document);
				const cached = this.isVersionCached(e.document, offsets);
				if (cached) {
					// if we've found these offsets are the same as what's cache...
					// then it was an undo, or some other operation that made it the
					// same as what was saved
					isDirty = false;
				}
				SessionContainer.instance().session.agent.sendNotification(DidChangeDataNotificationType, {
					type: ChangeDataType.Documents,
					data: {
						reason: "changed",
						document: {
							isDirty: isDirty,
							uri: e.document.uri
						}
					}
				});
			}),
			this._documents.onDidSave(e => {
				Logger.log(`Document saved: ${e.document.uri}`);
				let store = true;
				const offsets = this.getLineOffsets(e.document);
				const cached = this.isVersionCached(e.document, offsets);
				if (cached) {
					// if we've found these offsets are the same as what's cache...
					// then it was an undo or multiple saves, or some other operation that made it the
					// same as what was saved
					store = false;
				}

				if (store && offsets) {
					// if the content we're saving is the same that is in the cache don't notify
					this._savedContentCache[e.document.uri] = offsets;
					SessionContainer.instance().session.agent.sendNotification(
						DidChangeDataNotificationType,
						{
							type: ChangeDataType.Documents,
							data: {
								reason: "saved",
								document: {
									isDirty: false,
									uri: e.document.uri
								}
							}
						}
					);
				}
			}),
			this._documents.onDidOpen(e => {
				Logger.log(`Document opened: ${e.document.uri}`);
				const offsets = this.getLineOffsets(e.document);
				if (offsets) {
					this._savedContentCache[e.document.uri] = offsets;
				}
			}),
			this._documents.onDidClose(e => {
				Logger.log(`Document closed: ${e.document.uri}`);
				SessionContainer.instance().session.agent.sendNotification(DidChangeDataNotificationType, {
					type: ChangeDataType.Documents,
					data: {
						reason: "removed",
						document: {
							isDirty: undefined,
							uri: e.document.uri
						}
					}
				});
				delete this._savedContentCache[e.document.uri];
			})
		);

		this._documents.listen(connection);
	}

	// If this version of the document is in cache
	// and its offsets are the same as in the cache -- true
	isVersionCached(document: TextDocument, offsets: Number[] | undefined) {
		if (!offsets || !offsets.length) return false;

		const cached = this._savedContentCache[document.uri];
		if (cached) {
			if (this.orderedArraysAreEqual(cached, offsets)) {
				return true;
			}
		}

		return false;
	}

	orderedArraysAreEqual(a1: Number[], a2: Number[]) {
		let i = a1.length;
		if (i !== a2.length) return false;

		while (i--) {
			if (a1[i] !== a2[i]) return false;
		}
		return true;
	}

	getLineOffsets(document: TextDocument): Number[] | undefined {
		// slightly naughty here... using an internal function 😬
		try {
			if (document) {
				const documentPlus = document as any;
				if (typeof documentPlus.getLineOffsets === "function") {
					return documentPlus.getLineOffsets();
				}
			}
		} catch (ex) {
			// suffer
		}
		return undefined;
	}

	dispose() {
		this._disposable && this._disposable.dispose();
	}

	get(uri: string): TextDocument | undefined {
		const key = this._normalizedUriLookup.get(uri);
		if (key !== undefined) {
			return this._documents.get(key);
		}

		let doc = this._documents.get(uri);
		if (doc !== undefined) return doc;

		const decodedUri = URI.parse(uri).toString(true);
		const encodedSpacesUri = decodedUri.replace(/ /, "%20");
		doc = this._documents.get(decodedUri) || this._documents.get(encodedSpacesUri);
		if (doc !== undefined) {
			this._normalizedUriLookup.set(uri, doc.uri);
		}

		if (doc || !this._isWindows) {
			return doc;
		}

		// If we are on windows we have to do some drive letter manipulation to support different editor using different uri formatting
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
