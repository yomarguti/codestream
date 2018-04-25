// 'use strict';
// import { CancellationToken, CodeLens, CodeLensProvider, Disposable, DocumentSelector, Event, EventEmitter, languages, Range, TextDocument, TextEditorSelectionChangeEvent, window, workspace } from 'vscode';

// export class CodeStreamCodeLensProvider extends Disposable implements CodeLensProvider {

//     static selector: DocumentSelector = { scheme: 'file' };

//     private _onDidChangeCodeLenses = new EventEmitter<void>();
//     public get onDidChangeCodeLenses(): Event<void> {
//         return this._onDidChangeCodeLenses.event;
//     }

//     private readonly _disposable: Disposable | undefined;

//     constructor() {
//         super(() => this.dispose());

//         this._disposable = Disposable.from(
//             languages.registerCodeLensProvider(CodeStreamCodeLensProvider.selector, this),
//             window.onDidChangeTextEditorSelection(this.onSelectionChanged, this)
//         );
//     }

//     dispose() {
//         this._disposable && this._disposable.dispose();
//     }

//     private onSelectionChanged(e: TextEditorSelectionChangeEvent) {
//         const qq = workspace.getConfiguration('vsliveshare', null).get<string>('join.reload.worskspaceId');
//         qq;

//         const range = e.selections[0];
//         if (range.start.compareTo(range.end) === 0) return;

//         this._onDidChangeCodeLenses.fire();
//     }

//     provideCodeLenses(document: TextDocument, token: CancellationToken): CodeLens[] | Thenable<CodeLens[] | null | undefined> | null | undefined {
//         const editor = window.activeTextEditor;
//         if (editor === undefined || editor.document !== document) return [];

//         const range = editor.selection;
//         if (range.start.compareTo(range.end) === 0) return [];

//         return [
//             {
//                 range: new Range(range.start, range.start),
//                 command: {
//                     title: `5 Comments`,
//                     command: 'codestream.openStream',
//                     arguments: [
//                         document.uri,
//                         range
//                 ]
//                 }
//             } as CodeLens
//             // {
//             //     range: new Range(range.start, range.start),
//             //     title: `Reference Code`,
//             //     command: 'codestream.postCode',
//             //     arguments: [
//             //         document.uri,
//             //         range
//             //     ]
//             // } as CodeLens
//         ];
//     }
// }