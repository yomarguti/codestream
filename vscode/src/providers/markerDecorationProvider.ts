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
	TextDocument,
	TextDocumentChangeEvent,
	TextEditor,
	TextEditorDecorationType,
	Uri,
	window,
	workspace
} from "vscode";
import {
	Marker,
	SessionStatus,
	SessionStatusChangedEvent,
	TextDocumentMarkersChangedEvent
} from "../api/session";
import { OpenStreamCommandArgs } from "../commands";
import { MarkerStyle } from "../config";
import { Container } from "../container";
import { Logger } from "../logger";
import { Functions } from "../system/function";

const inlineIcon = "display: inline-block; margin: 0 0.5em 0 0; vertical-align: middle";
const inlineShape = "display: inline-block; margin: 0 0.5em 0 0; vertical-align: middle";
const overlayIcon = "display: inline-block; left: 0; position: absolute; top: 0";
const overlayShape =
	"display: inline-block; left: 0; position: absolute; top: 50%; transform: translateY(-50%)";

const squircleDecoration = (position: string) => ({
	backgroundColor: "#3193f1",
	contentText: "",
	height: "0.75em",
	width: "0.75em",
	borderRadius: "25%",
	textDecoration: `none; ${position}`
});

const triangleDecoration = (position: string) => ({
	contentText: "",
	height: "0.75em",
	width: "0.75em",
	borderRadius: "25%",
	textDecoration: `none; border-left: 0.75em solid #3193f1; border-top: 0.5em solid transparent; border-bottom: 0.5em solid transparent; ${position}`
});

const bubbleDecoration = (position: string) => ({
	contentText: "",
	height: "16px",
	width: "16px",
	textDecoration: `none; background-image: url(${Uri.file(
		Container.context.asAbsolutePath("assets/images/marker-comment.svg")
	).toString()}); background-position: center; background-repeat: no-repeat; background-size: contain; ${position}`
});

const logoDecoration = (position: string) => ({
	contentText: "",
	height: "16px",
	width: "16px",
	textDecoration: `none; background-image: url(${Uri.file(
		Container.context.asAbsolutePath("assets/images/marker-codestream.svg")
	).toString()}); background-position: center; background-repeat: no-repeat; background-size: contain; ${position}`
});

export class MarkerDecorationProvider implements HoverProvider, Disposable {
	private readonly _disposable: Disposable | undefined;
	private readonly _inlineDecorationType: TextEditorDecorationType;
	private readonly _overlayDecorationType: TextEditorDecorationType;

	private readonly _markersCache = new Map<string, Promise<Marker[]>>();
	private _watchedEditorsMap: Map<string, () => void> | undefined;

	constructor() {
		let inline;
		let overlay;
		switch (Container.config.markerStyle) {
			case MarkerStyle.Logo:
				inline = logoDecoration(inlineIcon);
				overlay = logoDecoration(overlayIcon);
				break;
			case MarkerStyle.Squircle:
				inline = squircleDecoration(inlineIcon);
				overlay = squircleDecoration(overlayIcon);
				break;
			case MarkerStyle.Triangle:
				inline = triangleDecoration(inlineShape);
				overlay = triangleDecoration(overlayShape);
				break;
			default:
				inline = bubbleDecoration(inlineShape);
				overlay = bubbleDecoration(overlayShape);
				break;
		}

		this._inlineDecorationType = window.createTextEditorDecorationType({
			before: inline,
			overviewRulerColor: "#3193f1",
			overviewRulerLane: OverviewRulerLane.Center
		});

		this._overlayDecorationType = window.createTextEditorDecorationType({
			before: overlay,
			overviewRulerColor: "#3193f1",
			overviewRulerLane: OverviewRulerLane.Center
		});

		this._disposable = Disposable.from(
			this._inlineDecorationType,
			this._overlayDecorationType,
			languages.registerHoverProvider({ scheme: "file" }, this),
			Container.session.onDidChangeTextDocumentMarkers(this.onMarkersChanged, this),
			Container.session.onDidChangeSessionStatus(this.onSessionStatusChanged, this),
			window.onDidChangeVisibleTextEditors(this.onEditorVisibilityChanged, this),
			workspace.onDidChangeTextDocument(this.onDocumentChanged, this),
			workspace.onDidCloseTextDocument(this.onDocumentClosed, this)
		);

		if (Container.session.status === SessionStatus.SignedIn) {
			this.applyToApplicableVisibleEditors();
		}
	}

	dispose() {
		this.clear();
		this._disposable && this._disposable.dispose();
	}

	private async onDocumentChanged(e: TextDocumentChangeEvent) {
		if (this._watchedEditorsMap === undefined) return;

		const fn = this._watchedEditorsMap.get(e.document.uri.toString());
		if (fn === undefined) return;

		fn();
	}

	private async onDocumentClosed(e: TextDocument) {
		this._markersCache.delete(e.uri.toString());
	}

	private async onEditorVisibilityChanged(e: TextEditor[]) {
		this.applyToApplicableVisibleEditors(e);
	}

	private onMarkersChanged(e: TextDocumentMarkersChangedEvent) {
		const uri = e.uri.toString();
		this._markersCache.delete(uri);

		const editors = this.getApplicableVisibleEditors();
		if (editors.length === 0) return;

		const editor = editors.find(e => e.document.uri.toString() === uri);
		if (editor === undefined) return;

		this.apply(editor);
	}

	private onSessionStatusChanged(e: SessionStatusChangedEvent) {
		switch (e.getStatus()) {
			case SessionStatus.SignedOut:
				this.clear();
				break;

			case SessionStatus.SignedIn:
				this.applyToApplicableVisibleEditors();
				break;
		}
	}

	async apply(editor: TextEditor | undefined, force: boolean = false) {
		if (!Container.session.signedIn || !this.isApplicableEditor(editor)) return;

		if (force) {
			this._markersCache.delete(editor!.document.uri.toString());
		}
		const decorations = await this.provideDecorations(editor!);
		editor!.setDecorations(this._inlineDecorationType, decorations.inline);
		editor!.setDecorations(this._overlayDecorationType, decorations.overlay);
	}

	applyToApplicableVisibleEditors(editors = window.visibleTextEditors) {
		const editorsToWatch = new Map<string, () => void>();

		for (const e of this.getApplicableVisibleEditors(editors)) {
			const key = e.document.uri.toString();
			editorsToWatch.set(
				key,
				(this._watchedEditorsMap && this._watchedEditorsMap.get(key)) ||
					Functions.debounce(() => this.apply(e, true), 1000)
			);

			this.apply(e);
		}

		this._watchedEditorsMap = editorsToWatch;
	}

	clear(editor: TextEditor | undefined = window.activeTextEditor) {
		if (editor === undefined) return;

		editor.setDecorations(this._inlineDecorationType, []);
		editor.setDecorations(this._overlayDecorationType, []);
	}

	async provideDecorations(
		editor: TextEditor /*, token: CancellationToken */
	): Promise<{ inline: DecorationOptions[]; overlay: DecorationOptions[] }> {
		const markers = await this.getMarkers(editor.document.uri);
		if (markers.length === 0) return { inline: [], overlay: [] };

		const inlineDecorations: DecorationOptions[] = [];
		const overlayDecorations: DecorationOptions[] = [];

		const starts = new Set();
		for (const marker of markers) {
			const start = marker.range.start.line;
			if (starts.has(start)) continue;

			// Determine if the marker needs to be inline (i.e. part of the content or overlayed)
			const inline = editor.document.lineAt(start).firstNonWhitespaceCharacterIndex === 0;
			(inline ? inlineDecorations : overlayDecorations).push({
				range: marker.hoverRange // editor.document.validateRange(marker.hoverRange)
			});
			starts.add(start);
		}

		return { inline: inlineDecorations, overlay: overlayDecorations };
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

		const hoveredMarkers = markers.filter(
			m => m.hoverRange.contains(position) // document.validateRange(m.hoverRange).contains(position)
		);
		if (hoveredMarkers.length === 0) return undefined;

		// Make sure we don't start queuing up requests to get the hovers
		if (this._hoverPromise !== undefined) {
			void (await this._hoverPromise);
			if (token.isCancellationRequested) return undefined;
		}

		this._hoverPromise = this.provideHoverCore(document, hoveredMarkers, token);
		return this._hoverPromise;
	}

	async provideHoverCore(
		document: TextDocument,
		markers: Marker[],
		token: CancellationToken
	): Promise<Hover | undefined> {
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
						range.union(m.hoverRange); // document.validateRange(m.hoverRange));
					} else {
						range = m.hoverRange; // document.validateRange(m.hoverRange);
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
			const resp = await Container.agent.markers.fetch(uri);
			return resp !== undefined
				? resp.markers.map(
						m =>
							new Marker(Container.session, m, [
								m.range.start.line,
								m.range.start.character,
								m.range.end.line,
								m.range.end.character,
								undefined
							])
				  )
				: [];
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
