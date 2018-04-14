'use strict';
import { CancellationToken, CodeActionContext, CodeActionProvider, Command, Disposable, DocumentSelector, languages, Range, TextDocument } from 'vscode';

export class CodeStreamCodeActionProvider extends Disposable implements CodeActionProvider {

    static selector: DocumentSelector = { scheme: 'file' };

    private readonly _disposable: Disposable | undefined;

    constructor() {
        super(() => this.dispose());

        this._disposable = languages.registerCodeActionsProvider(CodeStreamCodeActionProvider.selector, this);
    }

    dispose() {
        this._disposable && this._disposable.dispose();
    }

    provideCodeActions(document: TextDocument, range: Range, context: CodeActionContext, token: CancellationToken): Command[] | Thenable<Command[]> {
        if (range.start.compareTo(range.end) === 0) return [];

        return [
            {
                title: `Add a Comment`,
                command: 'codestream.postCode',
                arguments: [
                    document.uri,
                    range
                ]
            } as Command
            // {
            //     title: `Reference Code`,
            //     command: 'codestream.postCode',
            //     arguments: [
            //         document.uri,
            //         range
            //     ]
            // } as Command
        ];
    }
}