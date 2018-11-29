"use strict";
import {
	CancellationToken,
	ConfigurationChangeEvent,
	DecorationOptions,
	DecorationRangeBehavior,
	Disposable,
	Hover,
	HoverProvider,
	languages,
	MarkdownString,
	OverviewRulerLane,
	Position,
	Range,
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
import { configuration } from "../configuration";
import { Container } from "../container";
import { Logger } from "../logger";
import { Functions } from "../system/function";
import { Strings } from "../system/string";

const positionStyleMap: { [key: string]: string } = {
	inline: "display: inline-block; margin: 0 0.5em 0 0; vertical-align: middle;",
	overlay:
		"display: inline-block; left: 0; position: absolute; top: 50%; transform: translateY(-50%)"
};

const buildDecoration = (position: string, type: string, color: string, status: string) => ({
	contentText: "",
	height: "16px",
	width: "16px",
	textDecoration: `none; background-image: url(${Uri.file(
		Container.context.asAbsolutePath(`assets/images/marker-${type}-${color}.png`)
	).toString()}); background-position: center; background-repeat: no-repeat; background-size: contain; ${
		positionStyleMap[position]
	}`
});

const MarkerPositions = ["inline", "overlay"];
const MarkerTypes = ["comment", "question", "issue", "trap", "bookmark"];
const MarkerColors = ["blue", "green", "yellow", "orange", "red", "purple", "aqua", "gray"];
const MarkerStatuses = ["open", "closed"];
const MarkerHighlights: { [key: string]: string } = {
	// blue: "rgba(53, 120, 186, .25)",
	// green: "rgba(122, 186, 93, .25)",
	// yellow: "rgba(237, 214, 72, .25)",
	// orange: "rgba(241, 163, 64, .25)",
	// red: "rgba(217, 99, 79, .25)",
	// purple: "rgba(184, 124, 218, .25)",
	// aqua: "rgba(90, 191, 220, .25)",
	// gray: "rgba(127, 127, 127, .25)"
	blue: "rgba(0, 110, 183, .25)",
	green: "rgba(88, 181, 71, .25)",
	yellow: "rgba(240, 208, 5, .25)",
	orange: "rgba(255, 147, 25, .25)",
	red: "rgba(232, 78, 62, .25)",
	purple: "rgba(187, 108, 220, .25)",
	aqua: "rgba(0, 186, 220, .25)",
	gray: "rgba(127, 127, 127, .25)"
};

export class MarkerDecorationProvider implements HoverProvider, Disposable {
	private readonly _disposable: Disposable | undefined;
	private readonly _decorationType: { [key: string]: TextEditorDecorationType };

	private readonly _markersCache = new Map<string, Promise<Marker[]>>();
	private _watchedEditorsMap: Map<string, () => void> | undefined;

	constructor() {
		this._decorationType = {};

		for (const position of MarkerPositions) {
			for (const type of MarkerTypes) {
				for (const color of MarkerColors) {
					for (const status of MarkerStatuses) {
						const key = `${position}-${type}-${color}-${status}`;
						this._decorationType[key] = window.createTextEditorDecorationType({
							before: buildDecoration(position, type, color, status),
							overviewRulerColor: "#3193f1",
							overviewRulerLane: OverviewRulerLane.Center
						});
					}
				}
			}
		}

		for (const color of MarkerColors) {
			this._decorationType[`trap-highlight-${color}`] = window.createTextEditorDecorationType({
				rangeBehavior: DecorationRangeBehavior.OpenOpen,
				isWholeLine: true,
				backgroundColor: MarkerHighlights[color]
			});
		}

		this._disposable = Disposable.from(
			...Object.values(this._decorationType),
			languages.registerHoverProvider({ scheme: "file" }, this),
			Container.session.onDidChangeTextDocumentMarkers(this.onMarkersChanged, this),
			Container.session.onDidChangeSessionStatus(this.onSessionStatusChanged, this),
			window.onDidChangeVisibleTextEditors(this.onEditorVisibilityChanged, this),
			workspace.onDidChangeTextDocument(this.onDocumentChanged, this),
			workspace.onDidCloseTextDocument(this.onDocumentClosed, this),
			configuration.onDidChange(this.onConfigurationChanged, this)
		);

		if (Container.session.status === SessionStatus.SignedIn) {
			this.applyToApplicableVisibleEditors();
		}
	}

	private onConfigurationChanged(e: ConfigurationChangeEvent) {
		if (configuration.changed(e, configuration.name("showMarkers").value)) {
			const cfg = Container.config;

			window.visibleTextEditors.forEach(editor => {
				if (cfg.showMarkers) Container.markerDecorations.apply(editor, true);
				else Container.markerDecorations.clear(editor);
			});
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
				this.clearAll();
				break;

			case SessionStatus.SignedIn:
				this.applyToApplicableVisibleEditors();
				break;
		}
	}

	private clearAll() {
		this._markersCache.clear();
		for (const editor of this.getApplicableVisibleEditors()) {
			this.clear(editor);
		}
	}

	async apply(editor: TextEditor | undefined, force: boolean = false) {
		if (!Container.session.signedIn || !this.isApplicableEditor(editor)) return;

		if (force) this._markersCache.delete(editor!.document.uri.toString());

		const decorations = await this.provideDecorations(editor!);

		for (const [key, value] of Object.entries(this._decorationType)) {
			editor!.setDecorations(value, decorations[key] || []);
		}
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

		Object.values(this._decorationType).forEach(decoration => {
			editor.setDecorations(decoration, []);
		});
	}

	async provideDecorations(
		editor: TextEditor /*, token: CancellationToken */
	): Promise<{ [key: string]: DecorationOptions[] }> {
		if (!Container.config.showMarkers) return {};

		const markers = await this.getMarkers(editor.document.uri);
		if (markers.length === 0) return {};

		const decorations: { [key: string]: DecorationOptions[] } = {};

		const starts = new Set();
		for (const marker of markers) {
			const start = marker.range.start.line;
			if (marker.type === "issue" && marker.status === "closed") continue;
			if (starts.has(start)) continue;

			// Determine if the marker needs to be inline (i.e. part of the content or overlayed)
			const position =
				editor.document.lineAt(start).firstNonWhitespaceCharacterIndex === 0 ? "inline" : "overlay";
			const key = `${position}-${marker.type}-${marker.color}-${marker.status}`;

			if (!decorations[key]) {
				decorations[key] = [];
			}

			if (marker.type === "trap") {
				if (!decorations[`trap-highlight-${marker.color}`]) {
					decorations[`trap-highlight-${marker.color}`] = [];
				}

				decorations[`trap-highlight-${marker.color}`].push({
					range: new Range(
						marker.range.start.line,
						marker.range.start.character,
						marker.range.end.line,
						1000000
					)
				});
			} else continue;

			// decorations[key].push({
			// 	range: marker.hoverRange, // editor.document.validateRange(marker.hoverRange)
			// 	renderOptions: {}
			// });

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
							id: post.threadId,
							streamId: post.streamId
						}
					} as OpenStreamCommandArgs;

					if (message) {
						message += "\n-----\n";
					}
					const typeString = Strings.toTitleCase(m.type);
					message = `__${sender!.name}__, ${post.fromNow()} &nbsp; _(${post.formatDate()})_\n\n>${
						m.summary
					}\n\n[__View ${typeString} \u2197__](command:codestream.openComment?${encodeURIComponent(
						JSON.stringify(args)
					)} "View ${typeString}")`;

					// &nbsp; &middot; &nbsp; [__Unpin Marker \u1F4CC__](command:codestream.openStream?${encodeURIComponent(
					// 	JSON.stringify(args)
					// )} "Unpin Marker")

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
