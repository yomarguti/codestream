// 'use strict';

// import { DecorationData, DecorationProvider, Disposable, Event, EventEmitter, ThemeColor, Uri, window } from 'vscode';

// export class UnreadDecorationProvider implements DecorationProvider {

//     private static unreadDecorationData: DecorationData = {
//         title: 'Unread',
//         abbreviation: 'U',
//         color: new ThemeColor('gitDecoration.submoduleResourceForeground')
//     };

//     private _disposable: Disposable | undefined;

//     private readonly _onDidChangeDecorations = new EventEmitter<Uri[]>();
//     public get onDidChangeDecorations(): Event<Uri[]> {
//         return this._onDidChangeDecorations.event;
//     }

//     constructor() {
//         // this.onDidChangeDecorations = fireEvent(anyEvent<any>(
//         //     filterEvent(workspace.onDidSaveTextDocument, e => e.fileName.endsWith('.gitignore')),
//         //     model.onDidOpenRepository,
//         //     model.onDidCloseRepository
//         // ));

//         this._disposable = window.registerDecorationProvider(this);
//     }

//     dispose() {
//         this._disposable && this._disposable.dispose();
//     }

//     async provideDecoration(uri: Uri): Promise<DecorationData | undefined> {
//         return UnreadDecorationProvider.unreadDecorationData;
//     }
// }
