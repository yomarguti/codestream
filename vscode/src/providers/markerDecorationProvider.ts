'use strict';
import { DecorationOptions, Disposable, MarkdownString, OverviewRulerLane, Range, TextEditor, TextEditorDecorationType, window } from 'vscode';
import { Container } from '../container';
import { SessionStatus, SessionStatusChangedEvent } from '../api/session';
import { Logger } from '../logger';
import { OpenStreamCommandArgs } from '../commands';

export class MarkerDecorationProvider extends Disposable {

    private readonly _disposable: Disposable | undefined;
    private readonly _decorationType: TextEditorDecorationType;

    constructor() {
        super(() => this.dispose());

        this._decorationType = window.createTextEditorDecorationType({
            before: {
                backgroundColor: '#3193f1',
                contentText: ' ',
                height: '0.75em',
                width: '0.75em',
                margin: '0 0.5em',
                borderRadius: '25%'
                // textDecoration: 'none; right: calc(100% - 1em); position: absolute'
            } as any,
            overviewRulerColor: '#3193f1',
            overviewRulerLane: OverviewRulerLane.Center,
            borderRadius: '10px'
        });

        this._disposable = Disposable.from(
            this._decorationType,
            window.onDidChangeActiveTextEditor(this.onEditorChanged, this),
            Container.session.onDidChangeStatus(this.onSessionStatusChanged, this)
        );

        if (Container.session.status === SessionStatus.SignedIn) {
            this.apply();
        }
    }

    dispose() {
        this.clear();
        this._disposable && this._disposable.dispose();
    }

    private async onEditorChanged(e: TextEditor | undefined) {
        if (e === undefined) return;

        this.apply();
    }

    private onSessionStatusChanged(e: SessionStatusChangedEvent) {
        switch (e.getStatus()) {
            case SessionStatus.SignedOut:
                this.clear();
                break;

            case SessionStatus.SignedIn:
                this.apply();
                break;
        }
    }

    async apply(editor: TextEditor | undefined = window.activeTextEditor) {
        if (editor === undefined) return;

        const decorations = await this.provideDecorations(editor);
        editor.setDecorations(this._decorationType, decorations);
    }

    clear(editor: TextEditor | undefined = window.activeTextEditor) {
        if (editor === undefined) return;

        editor.setDecorations(this._decorationType, []);
    }

    async provideDecorations(editor: TextEditor /*, token: CancellationToken */): Promise<DecorationOptions[]> {
        // TODO: Rework this to separate markers from hovers
        try {
            const markers = await Container.session.getMarkers(editor.document.uri);
            if (markers === undefined) return [];

            const decorations: DecorationOptions[] = [];

            const starts = new Set();
            for (const marker of await markers.items()) {
                const start = marker.range.start.line;
                if (starts.has(start)) continue;

                let message = undefined;
                const post = await marker.post();
                if (post !== undefined) {
                    const sender = await post.sender();

                    const args = {
                        streamThread: {
                            id: post.id,
                            streamId: post.streamId
                        }
                    } as OpenStreamCommandArgs;

                    message = new MarkdownString(`__${sender!.name}__, ${post.fromNow()} &nbsp; _(${post.formatDate()})_\n\n>${post.text}\n\n[__Open Comment \u2197__](command:codestream.openStream?${JSON.stringify(args)} "Open Comment")`);
                    message.isTrusted = true;
                }

                decorations.push({
                    range: new Range(start, 0, start, 0), // location[2], 10000000)
                    hoverMessage: message
                });
                starts.add(start);
            }

            return decorations;
        }
        catch (ex) {
            debugger;
            Logger.error(ex);
            return [];
        }
    }
}