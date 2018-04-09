'use strict';
import { commands, Disposable, Event, EventEmitter, TextDocumentContentProvider, Uri, ViewColumn, workspace } from 'vscode';
import { Container } from './container';

const streamUri = Uri.parse('codestream://authority/stream');

export class StreamWebViewProvider extends Disposable implements TextDocumentContentProvider {

    private readonly _onDidChange = new EventEmitter<Uri>();
    get onDidChange(): Event<Uri> {
        return this._onDidChange.event;
    }

    private readonly _disposable: Disposable;

    constructor() {
        super(() => this.dispose());

        this._disposable = Disposable.from(
            workspace.registerTextDocumentContentProvider(streamUri.scheme, this),
            commands.registerCommand('codestream.openStream', this.openStream, this)
            // commands.registerCommand('codestream.saveSettings', this.save, this)
        );
    }

    dispose() {
        this._disposable.dispose();
    }

    async provideTextDocumentContent(uri: Uri): Promise<string> {
        if (streamUri.toString() !== uri.toString()) return '';

        const doc = await workspace.openTextDocument(Uri.file(Container.context.asAbsolutePath(`./build/index.html`)));

        const text = doc.getText().replace(/{{root}}/g, Uri.file(Container.context.asAbsolutePath('.')).toString());
        // if (text.includes('\'{{data}}\'')) {
        //     text = text.replace(/'{{data}}'/g, JSON.stringify({
        //         config: Container.config,
        //         scope: this.getScope(uri),
        //         scopes: this.getAvailableScopes(),
        //         uri: uri.toString()
        //     }));
        // }

        return text;
    }

    refresh(uri ?: Uri) {
        // Logger.log('PageProvider.refresh');

        this._onDidChange.fire(uri || streamUri);
    }

    // async save(options: { changes: { [key: string]: any }, scope: 'user' | 'workspace', uri: string }) {
    //     // Logger.log(`PageProvider.save: options=${JSON.stringify(options)}`);

    //     this._scope.set(options.uri, options.scope);
    //     const target = options.scope === 'workspace'
    //         ? ConfigurationTarget.Workspace
    //         : ConfigurationTarget.Global;

    //     for (const key in options.changes) {
    //         const inspect = await configuration.inspect(key)!;
    //         if (inspect.defaultValue === options.changes[key]) {
    //             await configuration.update(key, undefined, target);
    //         }
    //         else {
    //             await configuration.update(key, options.changes[key], target);
    //         }
    //     }
    // }

    async openStream() {
        return await commands.executeCommand('vscode.previewHtml', streamUri, ViewColumn.Active, 'CodeStream');
    }
}
