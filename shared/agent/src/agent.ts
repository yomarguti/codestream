"use strict";
import {
	CancellationToken,
	ClientCapabilities,
	Connection,
	createConnection,
	DidChangeConfigurationNotification,
	DidChangeConfigurationParams,
	Disposable,
	Emitter,
	Event,
	InitializedParams,
	InitializeParams,
	InitializeResult,
	NotificationType,
	NotificationType0,
	ProposedFeatures,
	RequestHandler,
	RequestHandler0,
	RequestType,
	RequestType0,
	TextDocumentSyncKind
} from "vscode-languageserver";
import { Logger } from "./logger";
import { CodeStreamSession } from "./session";
import { AgentOptions } from "./shared/agent.protocol";
import { Disposables, memoize } from "./system";
import { Functions } from "./system/function";

export class CodeStreamAgent implements Disposable {
	private _onReady = new Emitter<void>();
	get onReady(): Event<void> {
		return this._onReady.event;
	}

	private _clientCapabilities: ClientCapabilities | undefined;
	private readonly _connection: Connection;
	private _disposable: Disposable | undefined;
	private _session: CodeStreamSession | undefined;

	constructor() {
		// Create a connection for the server. The connection uses Node's IPC as a transport.
		// Also include all preview / proposed LSP features.
		this._connection = createConnection(ProposedFeatures.all);
		Logger.initialize(this);

		this._connection.onInitialize(this.onInitialize.bind(this));
		this._connection.onInitialized(this.onInitialized.bind(this));
	}

	dispose() {
		this._disposable && this._disposable.dispose();
	}

	private async onInitialize(e: InitializeParams) {
		const capabilities = e.capabilities;
		this._clientCapabilities = capabilities;

		const agentOptions = e.initializationOptions! as AgentOptions;
		this._session = new CodeStreamSession(this, this._connection, agentOptions);

		if (agentOptions.isDebugging) {
			Logger.overrideIsDebugging();
		}

		// Give the agent some time to connect
		if (Logger.isDebugging) {
			void (await Functions.wait(5000));
		}
		const result = await this._session.login();

		return {
			capabilities: {
				textDocumentSync: TextDocumentSyncKind.Full
				// hoverProvider: true
			},
			result: result
		} as InitializeResult;
	}

	private async onInitialized(e: InitializedParams) {
		try {
			const subscriptions = [];

			if (this.supportsConfiguration) {
				// Register for all configuration changes
				subscriptions.push(
					await this._connection.client.register(DidChangeConfigurationNotification.type, undefined)
				);
			}

			this._disposable = Disposables.from(...subscriptions);

			this._onReady.fire(undefined);
		} catch (ex) {
			debugger;
			Logger.error(ex);
			throw ex;
		}
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

	get connection() {
		return this._connection;
	}

	registerHandler<R, E, RO>(type: RequestType0<R, E, RO>, handler: RequestHandler0<R, E>): void;
	registerHandler<P, R, E, RO>(
		type: RequestType<P, R, E, RO>,
		handler: RequestHandler<P, R, E>
	): void;
	registerHandler(type: any, handler: any): void {
		try {
			Logger.log(`Agent.registerHandler(${type.method})`);
			return this._connection.onRequest(type, handler);
		} catch (ex) {
			Logger.error(ex, `Agent.registerHandler(${type.method})`);
			throw ex;
		}
	}

	sendNotification<RO>(type: NotificationType0<RO>): void;
	sendNotification<P, RO>(type: NotificationType<P, RO>, params: P): void;
	sendNotification(type: any, params?: any): void {
		try {
			Logger.log(`Agent.sendNotification(${type.method})`);
			return this._connection.sendNotification(type, params);
		} catch (ex) {
			Logger.error(ex, `Agent.sendNotification(${type.method})`, params);
			throw ex;
		}
	}

	sendRequest<R, E, RO>(type: RequestType0<R, E, RO>, token?: CancellationToken): Thenable<R>;
	sendRequest<P, R, E, RO>(
		type: RequestType<P, R, E, RO>,
		params: P,
		token?: CancellationToken
	): Thenable<R>;
	sendRequest(type: any, params?: any, token?: CancellationToken): Thenable<any> {
		if (CancellationToken.is(params)) {
			token = params;
			params = undefined;
		}

		try {
			Logger.log(`Agent.sendRequest(${type.method})`);
			return this._connection.sendRequest(type, params, token);
		} catch (ex) {
			Logger.error(ex, `Agent.sendRequest(${type.method})`, params);
			throw ex;
		}
	}

	error(exception: Error): void;
	error(message: string): void;
	error(exceptionOrmessage: Error | string): void {
		this._connection.console.error(
			typeof exceptionOrmessage === "string" ? exceptionOrmessage : exceptionOrmessage.toString()
		);
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
