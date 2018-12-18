"use strict";
import {
	CancellationToken,
	ClientCapabilities,
	Connection,
	createConnection,
	DidChangeConfigurationNotification,
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
import { Container } from "./container";
import { Logger } from "./logger";
import { CodeStreamSession } from "./session";
import { AgentOptions, DidChangeDataNotificationType } from "./shared/agent.protocol";
import { Disposables, Functions, log, memoize } from "./system";

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
		try {
			const capabilities = e.capabilities;
			this._clientCapabilities = capabilities;

			const agentOptions = e.initializationOptions! as AgentOptions;

			Logger.level = agentOptions.traceLevel;
			if (agentOptions.isDebugging) {
				Logger.overrideIsDebugging();
			}

			// Pause for a bit to give the debugger a window of time to connect -- mainly for startup issues
			if (Logger.isDebugging) {
				void (await Functions.wait(5000));
			}

			Logger.log(
				`Agent for CodeStream v${agentOptions.extension.versionFormatted} in ${
					agentOptions.ide.name
				} (v${agentOptions.ide.version}) initializing...`
			);

			if (agentOptions.recordRequests) {
				const now = Date.now();
				const fs = require("fs");
				const filename = `/tmp/dump-${now}-agent_options.json`;
				const outString = JSON.stringify(agentOptions, null, 2);

				fs.writeFile(filename, outString, "utf8", () => {
					Logger.log(`Written ${filename}`);
				});
			}

			this._session = new CodeStreamSession(this, this._connection, agentOptions);
			const result = await this._session.login();

			return {
				capabilities: {
					textDocumentSync: TextDocumentSyncKind.Full
					// hoverProvider: true
				},
				result: result
			} as InitializeResult;
		} catch (ex) {
			debugger;
			Logger.error(ex);
			// TODO: Probably should avoid throwing here and return better error reporting to the extension
			throw ex;
		}
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
			// TODO: Probably should avoid throwing here and return better error reporting to the extension
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
	@log({
		args: false,
		prefix: (context, type) => `${context.prefix}(${type.method})`,
		timed: false
	})
	registerHandler(type: any, handler: any): void {
		if (Container.instance().session.recordRequests) {
			this._connection.onRequest(type, async function() {
				const now = Date.now();
				const fs = require("fs");
				const sanitize = require("sanitize-filename");
				const sanitizedURL = sanitize(type.method.replace(/\//g, "_"));
				const method = type.method;

				let result = handler.apply(null, arguments);
				if (typeof result.then === "function") {
					result = await result;
				}
				const out = {
					method: method,
					request: arguments[0],
					response: result
				};
				const outString = JSON.stringify(out, null, 2);
				const filename = `/tmp/dump-${now}-agent-${sanitizedURL}.json`;

				fs.writeFile(filename, outString, "utf8", () => {
					Logger.log(`Written ${filename}`);
				});

				return result;
			});
		} else {
			return this._connection.onRequest(type, handler);
		}
	}

	sendNotification<RO>(type: NotificationType0<RO>): void;
	sendNotification<P, RO>(type: NotificationType<P, RO>, params: P): void;
	@log({
		args: { 0: type => type.method },
		prefix: (context, type, params) =>
			`${context.prefix}(${type.method}${
				type.method === DidChangeDataNotificationType.method ? `:${params.type}` : ""
			})`
	})
	sendNotification(type: any, params?: any): void {
		return this._connection.sendNotification(type, params);
	}

	sendRequest<R, E, RO>(type: RequestType0<R, E, RO>, token?: CancellationToken): Thenable<R>;
	sendRequest<P, R, E, RO>(
		type: RequestType<P, R, E, RO>,
		params: P,
		token?: CancellationToken
	): Thenable<R>;
	@log({
		args: {
			0: type => type.method,
			1: params => (CancellationToken.is(params) ? undefined : params)
		},
		prefix: (context, type, params) =>
			`${context.prefix}(${type.method}${
				type.method === DidChangeDataNotificationType.method ? `:${params.type}` : ""
			})`
	})
	sendRequest(type: any, params?: any, token?: CancellationToken): Thenable<any> {
		if (CancellationToken.is(params)) {
			token = params;
			params = undefined;
		}

		return this._connection.sendRequest(type, params, token);
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
