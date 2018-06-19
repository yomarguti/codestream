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
	TextDocuments,
	WorkspaceFoldersChangeEvent
} from "vscode-languageserver";
import { CodeStreamApi } from "./api/api";
import { GitService } from "./git/gitService";
import { Logger } from "./logger";
import { memoize } from "./system";
import { gitApi, GitApiRepository } from "./git/git";

const defaults = {
	serverUrl: "https://api.codestream.com"
};

export class CodeStreamAgent implements Disposable, LSPLogger {
	private _api: CodeStreamApi | undefined;
	private readonly _connection: Connection;
	private _git: GitService | undefined;

	private _disposables: Disposable[] | undefined;
	private _clientCapabilities: ClientCapabilities | undefined;
	private _clientOptions:
		| {
				extensionVersion: string;
				gitPath: string;
				ideVersion: string;
		  }
		| undefined;

	private readonly _documents: TextDocuments = new TextDocuments();

	constructor() {
		// Create a connection for the server. The connection uses Node's IPC as a transport.
		// Also include all preview / proposed LSP features.
		this._connection = createConnection(ProposedFeatures.all);
		Logger.configure(this);

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
		this._clientOptions = e.initializationOptions;

		return {
			capabilities: {
				textDocumentSync: this._documents.syncKind,
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
		this._api = new CodeStreamApi(this, this._serverUrl, this.ideVersion, this.extensionVersion);

		setImmediate(async () => {
			const repos = await this._connection.sendRequest<GitApiRepository[]>(
				"codeStream/client/git/repos"
			);

			gitApi({
				getGitPath: async () => this.gitPath,
				getRepositories: async () => {
					return repos;
					// const repos = await this._connection.sendRequest<GitApiRepository[]>(
					// 	"codeStream/client/git/repos"
					// );
					// return repos;
				}
			});
		});
		this._git = new GitService();

		this._disposables = subscriptions;
	}

	private onConfigurationChanged(e: DidChangeConfigurationParams) {
		this._connection.console.log("Configuration change event received");
	}

	private onHover(e: TextDocumentPositionParams) {
		this._connection.console.log("Hover request received");
		return undefined;
	}

	private onRequest(method: string, ...params: any[]) {
		if (!method.startsWith("codeStream")) return undefined;

		this._connection.console.log(`Request ${method} received`);

		switch (method) {
			case "codeStream/git/repos": {
				return this._git!.getRepositories();
			}
			case "codeStream/git/repo/remote": {
				const { uri } = params[0];
				return this._git!.getRepoRemote(uri);
			}
			case "codeStream/git/textDocument/authors": {
				const {
					textDocument: { uri },
					options
				} = params[0];
				return this._git!.getFileAuthors(uri, options);
			}
			case "codeStream/git/textDocument/revision": {
				const {
					textDocument: { uri }
				} = params[0];
				return this._git!.getFileCurrentSha(uri);
			}
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

	get api() {
		return this._api;
	}

	@memoize
	get extensionVersion() {
		return (this._clientOptions && this._clientOptions.extensionVersion) || "";
	}

	@memoize
	get gitPath() {
		return (this._clientOptions && this._clientOptions.gitPath) || "";
	}

	@memoize
	get ideVersion() {
		return (this._clientOptions && this._clientOptions.ideVersion) || "";
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
