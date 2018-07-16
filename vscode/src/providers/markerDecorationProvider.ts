"use strict";
import {
	CancellationToken,
	DecorationOptions,
	Disposable,
	Hover,
	HoverProvider,
	languages,
	MarkdownString,
	OverviewRulerLane,
	Position,
	Range,
	TextDocument,
	TextEditor,
	TextEditorDecorationType,
	Uri,
	window,
	workspace
} from "vscode";
import {
	Marker,
	PostsReceivedEvent,
	SessionStatus,
	SessionStatusChangedEvent
} from "../api/session";
import { OpenStreamCommandArgs } from "../commands";
import { Container } from "../container";
import { Logger } from "../logger";

export class MarkerDecorationProvider implements HoverProvider, Disposable {
	private readonly _disposable: Disposable | undefined;
	private readonly _decorationType: TextEditorDecorationType;

	private readonly _markersCache = new Map<string, Promise<Marker[]>>();

	constructor() {
		this._decorationType = window.createTextEditorDecorationType({
			before: {
				backgroundColor: "#3193f1",
				contentText: " ",
				height: "0.75em",
				width: "0.75em",
				margin: "0 0.5em",
				borderRadius: "25%"
				// textDecoration: 'none; right: calc(100% - 1em); position: absolute'
			} as any,
			overviewRulerColor: "#3193f1",
			overviewRulerLane: OverviewRulerLane.Center,
			borderRadius: "10px"
		});

		this._disposable = Disposable.from(
			this._decorationType,
			languages.registerHoverProvider({ scheme: "file" }, this),
			Container.session.onDidChangeStatus(this.onSessionStatusChanged, this),
			Container.session.onDidReceivePosts(this.onPostsReceived, this),
			window.onDidChangeActiveTextEditor(this.onEditorChanged, this),
			workspace.onDidCloseTextDocument(this.onClosedDocument, this)
		);

		if (Container.session.status === SessionStatus.SignedIn) {
			for (const e of this.getApplicableVisibleEditors()) {
				this.apply(e);
			}
		}
	}

	dispose() {
		this.clear();
		this._disposable && this._disposable.dispose();
	}

	private async onClosedDocument(e: TextDocument) {
		this._markersCache.delete(e.uri.toString());
	}

	private async onEditorChanged(e: TextEditor | undefined) {
		if (e === undefined) return;

		this.apply(e);
	}

	private async onPostsReceived(e: PostsReceivedEvent) {
		const editors = this.getApplicableVisibleEditors();
		if (editors.length === 0) return;

		const posts = e.entities().filter(p => p.codeBlocks !== undefined && p.codeBlocks.length !== 0);
		if (posts.length === 0) return;

		// This is lame, but for right now its too much of a pain to figure out which editor to clear
		this._markersCache.clear();

		for (const e of editors) {
			const uri = e.document.uri;
			const repo = await Container.session.getRepositoryByUri(uri);
			if (repo === undefined) continue;

			const file = repo.relativizeUri(uri);

			for (const p of posts) {
				if (p.codeBlocks!.some(cb => cb.file === file)) {
					this.apply(e);

					break;
				}
			}
		}
	}

	private onSessionStatusChanged(e: SessionStatusChangedEvent) {
		switch (e.getStatus()) {
			case SessionStatus.SignedOut:
				this.clear();
				break;

			case SessionStatus.SignedIn:
				for (const e of this.getApplicableVisibleEditors()) {
					this.apply(e);
				}
				break;
		}
	}

	async apply(editor: TextEditor | undefined) {
		if (!Container.session.signedIn || !this.isApplicableEditor(editor)) return;

		const decorations = await this.provideDecorations(editor!);
		editor!.setDecorations(this._decorationType, decorations);
	}

	clear(editor: TextEditor | undefined = window.activeTextEditor) {
		if (editor === undefined) return;

		editor.setDecorations(this._decorationType, []);
	}

	async provideDecorations(
		editor: TextEditor /*, token: CancellationToken */
	): Promise<DecorationOptions[]> {
		const markers = await this.getMarkers(editor.document.uri);
		if (markers.length === 0) return [];

		const decorations: DecorationOptions[] = [];

		const starts = new Set();
		for (const marker of markers) {
			const start = marker.range.start.line;
			if (starts.has(start)) continue;

			decorations.push({
				range: new Range(start, 0, start, 0)
			});
			starts.add(start);
		}

		return decorations;
	}

	private _hoverPromise: Promise<Hover | undefined> | undefined;
	async provideHover(
		document: TextDocument,
		position: Position,
		token: CancellationToken
	): Promise<Hover | undefined> {
		if (Container.session.status !== SessionStatus.SignedIn) return undefined;

		const markers = await this.getMarkers(document.uri);
		if (markers.length === 0 || token.isCancellationRequested) return undefined;

		const hoveredMarkers = markers.filter(m => m.hoverRange.contains(position));
		if (hoveredMarkers.length === 0) return undefined;

		// Make sure we don't start queuing up requests to get the hovers
		if (this._hoverPromise !== undefined) {
			void (await this._hoverPromise);
			if (token.isCancellationRequested) return undefined;
		}

		this._hoverPromise = this.provideHoverCore(hoveredMarkers, token);
		return this._hoverPromise;
	}

	async provideHoverCore(markers: Marker[], token: CancellationToken): Promise<Hover | undefined> {
		try {
			let message = undefined;
			let range = undefined;

			for (const m of markers) {
				try {
					const post = await m.post();
					if (token.isCancellationRequested) return undefined;
					if (post === undefined) continue;

					const sender = await post.sender();
					if (token.isCancellationRequested) return undefined;

					const args = {
						streamThread: {
							id: post.id,
							streamId: post.streamId
						}
					} as OpenStreamCommandArgs;

					if (message) {
						message += "\n-----\n";
					}
					message = `__${sender!.name}__, ${post.fromNow()} &nbsp; _(${post.formatDate()})_\n\n>${
						post.text
					}\n\n[__Open Comment \u2197__](command:codestream.openStream?${encodeURIComponent(
						JSON.stringify(args)
					)} "Open Comment")`;

					if (range) {
						range.union(m.hoverRange);
					} else {
						range = m.hoverRange;
					}
				} catch (ex) {
					Logger.error(ex);
				}
			}

			if (message === undefined || range === undefined) return undefined;

			const markdown = new MarkdownString(message);
			markdown.isTrusted = true;

			return new Hover(markdown, range);
		} finally {
			this._hoverPromise = undefined;
		}
	}

	private getApplicableVisibleEditors(editors = window.visibleTextEditors) {
		return editors.filter(this.isApplicableEditor);
	}

	private async getMarkers(uri: Uri) {
		const uriKey = uri.toString();

		let markersPromise = this._markersCache.get(uriKey);
		if (markersPromise === undefined) {
			markersPromise = this.getMarkersCore(uri);
			this._markersCache.set(uriKey, markersPromise);
		}

		return markersPromise;
	}

	private async getMarkersCore(uri: Uri) {
		try {
			const resp = await Container.agent.getMarkers(uri);
			resp;
		} catch (ex) {
			debugger;
		}

		try {
			const collection = await Container.session.getMarkers(uri);
			const markers = collection === undefined ? [] : [...(await collection.items())];
			return markers;
		} catch (ex) {
			Logger.error(ex);
			return [];
		}
	}

	private isApplicableEditor(editor: TextEditor | undefined) {
		return (
			editor !== undefined && editor.document !== undefined && editor.document.uri.scheme === "file"
		);
	}
}
