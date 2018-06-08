'use strict';

import {
    ClientCapabilities,
    Connection,
    createConnection,
    DidChangeConfigurationNotification,
    DidChangeConfigurationParams,
    DidChangeWatchedFilesParams,
    Disposable,
    InitializeParams,
    InitializeResult,
    ProposedFeatures,
    TextDocumentPositionParams,
    TextDocuments,
    WorkspaceFoldersChangeEvent
} from 'vscode-languageserver';
import { memoize } from './system';

class Server implements Disposable {
    private readonly _connection: Connection;
    private _disposables: Disposable[] | undefined;
    private _clientCapabilities: ClientCapabilities | undefined;

    private readonly _documents: TextDocuments = new TextDocuments();

    constructor() {
        // Create a connection for the server. The connection uses Node's IPC as a transport.
        // Also include all preview / proposed LSP features.
        this._connection = createConnection(ProposedFeatures.all);

        this._connection.onInitialize(this.onInitialize.bind(this));
        this._connection.onInitialized(this.onInitialized.bind(this));
        this._connection.onDidChangeConfiguration(this.onConfigurationChanged.bind(this));
        this._connection.onDidChangeWatchedFiles(this.onWatchedFilesChanged.bind(this));
        this._connection.onHover(this.onHover.bind(this));
        this._connection.onRequest(this.onRequest.bind(this));

        // Listen for open/change/close TextDocument events
        this._documents.listen(this._connection);
    }

    dispose() {
        this._disposables && this._disposables.forEach(d => d.dispose());
    }

    private onInitialize(e: InitializeParams) {
        const capabilities = e.capabilities;
        this._clientCapabilities = capabilities;

        return {
            capabilities: {
                textDocumentSync: this._documents.syncKind,
                hoverProvider: true
            }
        } as InitializeResult;
    }

    private async onInitialized() {
        const subscriptions = [];

        if (this.supportsConfiguration) {
            // Register for all configuration changes
            subscriptions.push(
                await this._connection.client.register(
                    DidChangeConfigurationNotification.type,
                    undefined
                )
            );
        }

        if (this.supportsWorkspaces) {
            subscriptions.push(
                this._connection.workspace.onDidChangeWorkspaceFolders(
                    this.onWorkspaceFoldersChanged,
                    this
                )
            );
        }

        this._disposables = subscriptions;
    }

    private onConfigurationChanged(e: DidChangeConfigurationParams) {
        this._connection.console.log('Configuration change event received');
    }

    private onHover(e: TextDocumentPositionParams) {
        this._connection.console.log('Hover request received');
        return undefined;
    }

    private onRequest(method: string, ...params: any[]) {
        this._connection.console.log(`Request ${method} received`);
        return undefined;
    }

    private onWatchedFilesChanged(e: DidChangeWatchedFilesParams) {
        // Monitored files have change in VSCode
        this._connection.console.log('Watched Files change event received');
    }

    private onWorkspaceFoldersChanged(e: WorkspaceFoldersChangeEvent) {
        this._connection.console.log('Workspace folder change event received');
    }

    @memoize
    get supportsConfiguration() {
        return (
            (this._clientCapabilities &&
                this._clientCapabilities.workspace &&
                !!this._clientCapabilities.workspace.configuration) ||
            false
        );
    }

    @memoize
    get supportsWorkspaces() {
        return (
            (this._clientCapabilities &&
                this._clientCapabilities.workspace &&
                !!this._clientCapabilities.workspace.workspaceFolders) ||
            false
        );
    }

    listen() {
        this._connection.listen();
    }
}

const server = new Server();
server.listen();
