'use strict';
import { DecorationOptions, Disposable, DocumentSelector, Range, TextEditor, TextEditorDecorationType, window } from 'vscode';
import { Container } from '../container';

export class CodeStreamMarkerDecorationProvider extends Disposable {

    static selector: DocumentSelector = { scheme: 'file' };

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
                // textDecoration: 'none; vertical-align: baseline'
            } as any,
            borderRadius: '10px'
        });
        this._disposable = Disposable.from(
            this._decorationType,
            window.onDidChangeActiveTextEditor(this.onEditorChanged, this)
        );
    }

    dispose() {
        this._disposable && this._disposable.dispose();
    }

    private async onEditorChanged(e: TextEditor | undefined) {
        if (e === undefined) return;

        const decorations = await this.provideDecorations(e);
        e.setDecorations(this._decorationType, decorations);
    }

    async provideDecorations(editor: TextEditor /*, token: CancellationToken */): Promise<DecorationOptions[]> {
        const session = Container.session;
        const markers = await session.getMarkers(editor.document.uri);
        if (markers === undefined) return [];

        const decorations: DecorationOptions[] = [];

        for (const location of Object.values(markers.markers.locations)) {
            decorations.push({
                range: new Range(location[0], 0, location[2], 10000000)
            });
        }

        return decorations;

        // const message = new MarkdownString(`*CodeStream*\n\nAkonwi wrote:\n\n\`\`\`This is some awesome code\`\`\`\n\n[Open Stream](command:codestream.openStream)`);
        // message.isTrusted = true;

        // return [
        //     {
        //         range: new Range(editor.selection.active, editor.selection.active.with(undefined, 5)),
        //         hoverMessage: message
        //     } as DecorationOptions
        // ];
    }
}