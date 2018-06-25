"use strict";

import {
	ClientCapabilities,
	Connection,
	createConnection,
	DidChangeConfigurationNotification,
	DidChangeConfigurationParams,
	DidChangeWatchedFilesParams,
	Disposable,
	GenericRequestHandler,
	InitializedParams,
	InitializeParams,
	InitializeResult,
	Logger as LSPLogger,
	ProposedFeatures,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	WorkspaceFoldersChangeEvent
} from "vscode-languageserver";
import { Container } from "./container";
import { Logger } from "./logger";
import { Disposables, memoize } from "./system";
import { gitApi, GitApiRepository } from "./git/git";
import { MarkerHandler } from "./marker/markerHandler";

const defaults = {
	serverUrl: "https://api.codestream.com"
};

export interface InitializationOptions {
	extensionVersion: string;
	gitPath: string;
	ideVersion: string;
}

export class CodeStreamAgent implements Disposable, LSPLogger {
	private _clientCapabilities: ClientCapabilities | undefined;
	private readonly _connection: Connection;
	private _disposable: Disposable | undefined;
	private _initializationOptions: InitializationOptions | undefined;

	constructor() {
		// Create a connection for the server. The connection uses Node's IPC as a transport.
		// Also include all preview / proposed LSP features.
		this._connection = createConnection(ProposedFeatures.all);
		Logger.initialize(this);

		this._connection.onInitialize(this.onInitialize.bind(this));
		this._connection.onInitialized(this.onInitialized.bind(this));
		this._connection.onDidChangeConfiguration(this.onConfigurationChanged.bind(this));
		this._connection.onDidChangeWatchedFiles(this.onWatchedFilesChanged.bind(this));
		this._connection.onHover(this.onHover.bind(this));

		// TODO: This should go away in favor of specific registrations
		this._connection.onRequest(this.onRequest.bind(this));
	}

	dispose() {
		this._disposable && this._disposable.dispose();
	}

	private onInitialize(e: InitializeParams) {
		const capabilities = e.capabilities;
		this._clientCapabilities = capabilities;
		this._initializationOptions = e.initializationOptions;

		return {
			capabilities: {
				textDocumentSync: TextDocumentSyncKind.Full,
				hoverProvider: true
			}
		} as InitializeResult;
	}

	private async onInitialized(e: InitializedParams) {
		const subscriptions = [];

		if (this.supportsConfiguration) {
			// Register for all configuration changes
			subscriptions.push(
				await this._connection.client.register(DidChangeConfigurationNotification.type, undefined)
			);
		}

		if (this.supportsWorkspaces) {
			subscriptions.push(
				this._connection.workspace.onDidChangeWorkspaceFolders(this.onWorkspaceFoldersChanged, this)
			);
		}

		this._serverUrl = await this.getServerUrl();
		void (await Container.initialize(this, this._connection, this._initializationOptions!));

		const repos = await this._connection.sendRequest<GitApiRepository[]>(
			"codeStream/client/git/repos"
		);

		gitApi({
			getGitPath: async () => Container.instance().gitPath,
			getRepositories: async () => {
				return repos;
				// const repos = await this._connection.sendRequest<GitApiRepository[]>(
				// 	"codeStream/client/git/repos"
				// );
				// return repos;
			}
		});

		this._disposable = Disposables.from(...subscriptions);
	}

	private onConfigurationChanged(e: DidChangeConfigurationParams) {
		Container.instance().updateConfig(e.settings.codestream);
	}

	private onHover(e: TextDocumentPositionParams) {
		this._connection.console.log("Hover request received");
		return undefined;
	}

	private onRequest(method: string, ...params: any[]) {
		if (!method.startsWith("codeStream")) return undefined;

		this._connection.console.log(`Request ${method} received`);

		switch (method) {
			case "codeStream/textDocument/markers":
				return MarkerHandler.handle(params);
		}

		return undefined;
	}

	private onWatchedFilesChanged(e: DidChangeWatchedFilesParams) {
		// Monitored files have change in VSCode
		this._connection.console.log("Watched Files change event received");
	}

	private onWorkspaceFoldersChanged(e: WorkspaceFoldersChangeEvent) {
		this._connection.console.log("Workspace folder change event received");
	}

	private _serverUrl: string | undefined;
	get serverUrl() {
		return this._serverUrl!;
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

	private async getServerUrl() {
		const url = await this._connection.workspace.getConfiguration("codestream.serverUrl");
		if (url) return url as string;

		return defaults.serverUrl;
	}

	registerHandler<R, E>(method: string, handler: GenericRequestHandler<R, E>) {
		return this._connection.onRequest<R, E>(method, handler);
	}

	error(exception: Error): void;
	error(message: string): void;
	error(exceptionOrmessage: Error | string): void {
		this._connection.console.error(
			typeof exceptionOrmessage === "string" ? exceptionOrmessage : exceptionOrmessage.toString()
		);
	}

	info(message: string): void {
		this._connection.console.info(message);
	}

	listen() {
		this._connection.listen();
	}

	log(message: string): void {
		this._connection.console.log(message);
	}

	warn(message: string): void {
		this._connection.console.warn(message);
	}
}

const agent = new CodeStreamAgent();
agent.listen();
