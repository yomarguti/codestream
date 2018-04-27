'use strict';
import { DecorationOptions, Disposable, OverviewRulerLane, Range, TextEditor, TextEditorDecorationType, window } from 'vscode';
import { Container } from '../container';
import { SessionStatus, SessionStatusChangedEvent } from '../api/session';

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
        const markers = await Container.session.getMarkers(editor.document.uri);
        if (markers === undefined) return [];

        const decorations: DecorationOptions[] = [];

        const starts = new Set();
        for (const location of Object.values(markers.markers.locations)) {
            const start = location[0];
            if (starts.has(start)) continue;

            decorations.push({
                range: new Range(start, 0, start, 0) // location[2], 10000000)
            });
            starts.add(start);
        }

        return decorations;

        // const message = new MarkdownString(`Akonwi wrote:\n\n\`\`\`This is some awesome code\`\`\`\n\n[Open Stream](command:codestream.openStream)`);
        // message.isTrusted = true;

        // return [
        //     {
        //         range: new Range(editor.selection.active, editor.selection.active.with(undefined, 5)),
        //         hoverMessage: message
        //     } as DecorationOptions
        // ];
    }
}