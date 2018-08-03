"use strict";
import { CSPost } from "codestream";
import { RequestInit } from "node-fetch";
import { Event, EventEmitter, ExtensionContext, Range, TextDocument, Uri } from "vscode";
import {
	CancellationToken,
	Disposable,
	LanguageClient,
	LanguageClientOptions,
	RequestType,
	RequestType0,
	ServerOptions,
	TransportKind
} from "vscode-languageclient";
import { GitRepository } from "../git/gitService";
import { Logger } from "../logger";
import {
	AgentInitializeResult,
	AgentOptions,
	AgentResult,
	ApiRequest,
	DocumentMarkersRequest,
	DocumentMarkersResponse,
	DocumentPostRequest,
	DocumentPreparePostRequest,
	DocumentPreparePostResponse,
	GitRepositoriesRequest
} from "./protocol";

export { AgentOptions } from "./protocol";

export class CodeStreamAgentConnection implements Disposable {
	private _onDidReceivePubNubMessages = new EventEmitter<{ [key: string]: any }[]>();
	get onDidReceivePubNubMessages(): Event<{ [key: string]: any }[]> {
		return this._onDidReceivePubNubMessages.event;
	}

	private _client: LanguageClient | undefined;
	private _disposable: Disposable | undefined;

	private _clientOptions: LanguageClientOptions;
	private _serverOptions: ServerOptions;

	constructor(context: ExtensionContext, options: AgentOptions) {
		// If the extension is launched in debug mode then the debug server options are used
		// Otherwise the run options are used
		this._serverOptions = {
			run: {
				module: context.asAbsolutePath("agent.js"),
				transport: TransportKind.ipc
			},
			debug: {
				module: context.asAbsolutePath("dist/agent.js"),
				transport: TransportKind.ipc,
				options: {
					execArgv: ["--nolazy", "--inspect=6009"] // "--inspect-brk=6009"
				}
			}
		};

		// Options to control the language client
		this._clientOptions = {
			initializationOptions: { ...options },
			// Register the server for file-based text documents
			documentSelector: [{ scheme: "file", language: "*" }],
			synchronize: {
				// Synchronize the setting section 'codestream' to the server
				configurationSection: "codestream"
			}
		};
	}

	dispose() {
		this._disposable && this._disposable.dispose();
	}

	get started() {
		return this._client && !this._client.needsStart();
	}

	@started
	async api<R>(url: string, init?: RequestInit, token?: string): Promise<R> {
		return this.sendRequest(ApiRequest, {
			url: url,
			init: init,
			token: token
		});
	}

	@started
	async getMarkers(uri: Uri): Promise<DocumentMarkersResponse | undefined> {
		try {
			const response = await this.sendRequest(DocumentMarkersRequest, {
				textDocument: { uri: uri.toString() }
			});
			return response;
		} catch (ex) {
			debugger;
			Logger.error(ex);
			throw ex;
		}
	}

	@started
	async getRepositories(): Promise<GitRepository[]> {
		try {
			const response = await this.sendRequest(GitRepositoriesRequest);
			const repositories = response.map(r => new GitRepository(Uri.parse(r.uri as string)));
			return repositories;
		} catch (ex) {
			debugger;
			Logger.error(ex);
			throw ex;
		}
	}

	async login(email: string, token: string, teamId?: string, team?: string): Promise<AgentResult> {
		const response = await this.start({
			...this._clientOptions.initializationOptions,
			email: email,
			token: token,
			team,
			teamId
		});

		if (response.result!.error) {
			await this.stop();
		}

		return response.result;
	}

	logout() {
		return this.stop();
	}

	preparePost(document: TextDocument, range: Range): Promise<DocumentPreparePostResponse> {
		return this.sendRequest(DocumentPreparePostRequest, {
			textDocument: { uri: document.uri.toString() },
			range: range,
			dirty: document.isDirty
		});
	}

	postCode(
		uri: Uri,
		// document: TextDocument,
		// range: Range,
		text: string,
		code: string,
		location: [number, number, number, number] | undefined,
		source:
			| {
					file: string;
					repoPath: string;
					revision: string;
					authors: { id: string; username: string }[];
					remotes: { name: string; url: string }[];
			  }
			| undefined,
		parentPostId: string | undefined,
		streamId: string
	): Promise<CSPost> {
		return this.sendRequest(DocumentPostRequest, {
			textDocument: { uri: uri.toString() },
			// range: range,
			// dirty: document.isDirty,
			text: text,
			code: code,
			location: location,
			source: source,
			parentPostId: parentPostId,
			streamId: streamId
		});
	}

	private onPubNubMessagesReceived(...messages: { [key: string]: any }[]) {
		console.log("Messages received");
		this._onDidReceivePubNubMessages.fire(messages);
	}

	private sendRequest<R, E, RO>(
		type: RequestType0<R, E, RO>,
		token?: CancellationToken
	): Promise<R>;
	private sendRequest<P, R, E, RO>(
		type: RequestType<P, R, E, RO>,
		params: P,
		token?: CancellationToken
	): Promise<R>;
	@started
	private async sendRequest(method: any, params?: any): Promise<any> {
		try {
			const response = await this._client!.sendRequest(method, params);
			return response;
		} catch (ex) {
			debugger;
			Logger.error(ex, `AgentConnection.sendRequest`, method, params);
			throw ex;
		}
	}
	private async start(options: Required<AgentOptions>): Promise<AgentInitializeResult> {
		if (this._client !== undefined) {
			throw new Error("Agent has already been started");
		}

		const clientOptions = {
			...this._clientOptions,
			initializationOptions: options
		};

		this._client = new LanguageClient(
			"codestream",
			"CodeStream",
			{ ...this._serverOptions } as ServerOptions,
			clientOptions
		);
		this._client.registerProposedFeatures();

		this._disposable = this._client.start();
		void (await this._client.onReady());

		this._client.onNotification(
			"codeStream/didReceivePubNubMessages",
			this.onPubNubMessagesReceived.bind(this)
		);

		return this._client.initializeResult! as AgentInitializeResult;
	}

	private async stop(): Promise<void> {
		if (this._client === undefined) return;

		this._disposable && this._disposable.dispose();
		await this._client.stop();

		this._client = undefined;
	}
}

function started(
	target: CodeStreamAgentConnection,
	propertyName: string,
	descriptor: TypedPropertyDescriptor<any>
) {
	if (typeof descriptor.value === "function") {
		const method = descriptor.value;
		descriptor.value = function(this: CodeStreamAgentConnection, ...args: any[]) {
			if (!this.started) throw new Error("CodeStream Agent has not been started");
			return method!.apply(this, args);
		};
	} else if (typeof descriptor.get === "function") {
		const get = descriptor.get;
		descriptor.get = function(this: CodeStreamAgentConnection, ...args: any[]) {
			if (!this.started) throw new Error("CodeStream Agent has not been started");
			return get!.apply(this, args);
		};
	}
}
