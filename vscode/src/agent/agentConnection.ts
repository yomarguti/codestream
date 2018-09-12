"use strict";
import { RequestInit } from "node-fetch";
import {
	commands,
	Event,
	EventEmitter,
	ExtensionContext,
	MessageItem,
	Range,
	TextDocument,
	Uri,
	window
} from "vscode";
import {
	CancellationToken,
	CloseAction,
	Disposable,
	ErrorAction,
	LanguageClient,
	LanguageClientOptions,
	Message,
	RequestType,
	RequestType0,
	RevealOutputChannelOn,
	ServerOptions,
	TransportKind
} from "vscode-languageclient";
import { CSCodeBlock, CSPost } from "../api/api";
import { BuiltInCommands } from "../commands";
import { extensionQualifiedId } from "../constants";
import { Container } from "../container";
import { Logger } from "../logger";
import {
	AccessToken,
	AgentInitializeResult,
	AgentOptions,
	AgentResult,
	ApiRequest,
	CodeStreamEnvironment,
	DidChangeDocumentMarkersNotification,
	DidChangeDocumentMarkersNotificationResponse,
	DidChangeVersionCompatibilityNotification,
	DidChangeVersionCompatibilityNotificationResponse,
	DidReceivePubNubMessagesNotification,
	DidReceivePubNubMessagesNotificationResponse,
	DocumentFromCodeBlockRequest,
	DocumentFromCodeBlockResponse,
	DocumentLatestRevisionRequest,
	DocumentLatestRevisionResponse,
	DocumentMarkersRequest,
	DocumentMarkersResponse,
	DocumentPostRequest,
	DocumentPreparePostRequest,
	DocumentPreparePostResponse,
	LogoutRequest,
	LogoutRequestParams,
	VersionCompatibility
} from "../shared/agent.protocol";

export {
	AccessToken,
	AgentOptions,
	AgentResult,
	CodeStreamEnvironment
} from "../shared/agent.protocol";

export interface PubNubMessagesReceivedEvent {
	[key: string]: any;
}

export interface DocumentMarkersChangedEvent {
	uri: Uri;
}

export class CodeStreamAgentConnection implements Disposable {
	private _onDidChangeDocumentMarkers = new EventEmitter<DocumentMarkersChangedEvent>();
	get onDidChangeDocumentMarkers(): Event<DocumentMarkersChangedEvent> {
		return this._onDidChangeDocumentMarkers.event;
	}

	private _onDidReceivePubNubMessages = new EventEmitter<PubNubMessagesReceivedEvent[]>();
	get onDidReceivePubNubMessages(): Event<PubNubMessagesReceivedEvent[]> {
		return this._onDidReceivePubNubMessages.event;
	}

	private _client: LanguageClient | undefined;
	private _disposable: Disposable | undefined;

	private _clientOptions: LanguageClientOptions;
	private _serverOptions: ServerOptions;

	constructor(context: ExtensionContext, options: AgentOptions) {
		this._serverOptions = {
			run: {
				module: context.asAbsolutePath("dist/agent.js"),
				transport: TransportKind.ipc
			},
			debug: {
				module: context.asAbsolutePath("../codestream-lsp-agent/dist/agent.js"),
				transport: TransportKind.ipc,
				options: {
					execArgv: ["--nolazy", "--inspect=6009"] // "--inspect-brk=6009"
				}
			}
		};

		this._clientOptions = {
			errorHandler: {
				error: (error: Error, message: Message, count: number) => {
					Logger.error(error, "AgentConnection.error", message.jsonrpc, count);

					const env = Container.session.environment;
					if (env === CodeStreamEnvironment.PD || env === CodeStreamEnvironment.QA) {
						window.showErrorMessage(
							`CodeStream Connection Error (${count})\n${error.message}\n${message.jsonrpc}`
						);
					}

					return ErrorAction.Continue;
				},
				closed: () => {
					Logger.error(undefined!, "AgentConnection.closed");

					const env = Container.session.environment;
					if (env === CodeStreamEnvironment.PD || env === CodeStreamEnvironment.QA) {
						window.showErrorMessage(
							`CodeStream Connection Closed\nAttempting to reestablish connection...`
						);
					}

					return CloseAction.Restart;
				}
			},
			outputChannelName: "CodeStream (Agent)",
			revealOutputChannelOn: RevealOutputChannelOn.Never,
			initializationOptions: { ...options },
			// Register the server for file-based text documents
			documentSelector: [
				{ scheme: "file", language: "*" },
				{ scheme: "untitled", language: "*" },
				{ scheme: "vsls", language: "*" }
			],
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
	getDocumentFromCodeBlock(block: CSCodeBlock): Promise<DocumentFromCodeBlockResponse | undefined> {
		return this.sendRequest(DocumentFromCodeBlockRequest, {
			repoId: block.repoId,
			file: block.file,
			markerId: block.markerId
		});
	}

	@started
	async getLatestRevision(uri: Uri): Promise<DocumentLatestRevisionResponse> {
		return this.sendRequest(DocumentLatestRevisionRequest, {
			textDocument: { uri: uri.toString() }
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

	async login(
		serverUrl: string,
		email: string,
		passwordOrToken: string | AccessToken,
		teamId?: string,
		team?: string
	): Promise<AgentResult> {
		const response = await this.start({
			...this._clientOptions.initializationOptions,
			serverUrl: serverUrl,
			email: email,
			passwordOrToken: passwordOrToken,
			team,
			teamId
		});

		if (response.result!.error) {
			await this.stop();
		}

		return response.result;
	}

	async loginViaSignupToken(serverUrl: string, token: string): Promise<AgentResult> {
		const response = await this.start({
			...this._clientOptions.initializationOptions,
			serverUrl: serverUrl,
			signupToken: token
		});

		if (response.result!.error) {
			await this.stop();
		}

		return response.result as AgentResult;
	}

	logout() {
		return this.stop();
	}

	@started
	preparePost(document: TextDocument, range: Range): Promise<DocumentPreparePostResponse> {
		return this.sendRequest(DocumentPreparePostRequest, {
			textDocument: { uri: document.uri.toString() },
			range: range,
			dirty: document.isDirty
		});
	}

	@started
	postCode(
		uri: Uri,
		// document: TextDocument,
		// range: Range,
		text: string,
		mentionedUserIds: string[],
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
			mentionedUserIds,
			text: text,
			code: code,
			location: location,
			source: source,
			parentPostId: parentPostId,
			streamId: streamId
		});
	}

	private onDocumentMarkersChanged(e: DidChangeDocumentMarkersNotificationResponse) {
		Logger.log("AgentConnection.onDocumentMarkersChanged", e.textDocument.uri);
		this._onDidChangeDocumentMarkers.fire({ uri: Uri.parse(e.textDocument.uri) });
	}

	private onLogout(e: LogoutRequestParams) {
		Logger.log("AgentConnection.onLogout", `reason=${e.reason}`);

		void Container.session.goOffline();
	}

	private onPubNubMessagesReceived(...messages: DidReceivePubNubMessagesNotificationResponse[]) {
		Logger.log("AgentConnection.onPubNubMessagesReceived", messages);
		this._onDidReceivePubNubMessages.fire(messages);
	}

	private async onVersionCompatibilityChanged(
		e: DidChangeVersionCompatibilityNotificationResponse
	) {
		switch (e.compatibility) {
			case VersionCompatibility.CompatibleUpgradeAvailable: {
				if (Container.session.environment === CodeStreamEnvironment.Production) return;

				const actions: MessageItem[] = [{ title: "Download" }, { title: "Later" }];

				const result = await window.showInformationMessage(
					"A new version of CodeStream is available.",
					...actions
				);
				if (result !== undefined && result.title === "Download") {
					await commands.executeCommand(BuiltInCommands.Open, Uri.parse(e.downloadUrl));
				}
				break;
			}
			case VersionCompatibility.CompatibleUpgradeRecommended: {
				if (Container.session.environment === CodeStreamEnvironment.Production) return;

				const actions: MessageItem[] = [{ title: "Download" }, { title: "Later" }];
				const result = await window.showWarningMessage(
					"A new version of CodeStream is available. We recommend upgrading as soon as possible.",
					...actions
				);
				if (result !== undefined && result.title === "Download") {
					await commands.executeCommand(BuiltInCommands.Open, Uri.parse(e.downloadUrl));
				}
				break;
			}
			case VersionCompatibility.UnsupportedUpgradeRequired: {
				await Container.session.goOffline();

				if (Container.session.environment === CodeStreamEnvironment.Production) {
					const actions: MessageItem[] = [{ title: "Upgrade" }];
					const result = await window.showErrorMessage(
						"This version of CodeStream is no longer supported. Please upgrade to the latest version.",
						...actions
					);

					if (result !== undefined) {
						await commands.executeCommand("workbench.extensions.action.checkForUpdates");
						await commands.executeCommand("workbench.extensions.action.showExtensionsWithIds", [
							extensionQualifiedId
						]);
					}
				} else {
					const actions: MessageItem[] = [{ title: "Download" }];
					const result = await window.showErrorMessage(
						"This version of CodeStream is no longer supported. Please download and install the latest version.",
						...actions
					);

					if (result !== undefined) {
						await commands.executeCommand(BuiltInCommands.Open, Uri.parse(e.downloadUrl));
					}
				}
				break;
			}
		}
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
	private async sendRequest(type: any, params?: any): Promise<any> {
		try {
			const traceParams =
				type.method === ApiRequest.method ? params.init && params.init.body : params;

			Logger.log(
				`AgentConnection.sendRequest(${type.method})${
					type.method === ApiRequest.method ? `: ${params.url}` : ""
				}`,
				traceParams ? `params=${sanitize(JSON.stringify(traceParams))}` : ""
			);
			const response = await this._client!.sendRequest(type, params);
			return response;
		} catch (ex) {
			// debugger;
			Logger.error(ex, `AgentConnection.sendRequest(${type.method})`, params);
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

		this._client.onRequest(LogoutRequest, this.onLogout.bind(this));

		this._client.onNotification(
			DidReceivePubNubMessagesNotification,
			this.onPubNubMessagesReceived.bind(this)
		);

		this._client.onNotification(
			DidChangeDocumentMarkersNotification,
			this.onDocumentMarkersChanged.bind(this)
		);

		this._client.onNotification(
			DidChangeVersionCompatibilityNotification,
			this.onVersionCompatibilityChanged.bind(this)
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

function sanitize(json: string) {
	if (json === undefined || typeof json !== "string") return "";

	return json
		.replace(/("password":)".*?"/gi, '$1"<hidden>"')
		.replace(/("token":)".*?"/gi, '$1"<hidden>"');
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
