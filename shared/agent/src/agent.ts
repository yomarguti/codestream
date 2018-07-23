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
import { CodeStreamApi, LoginResponse } from "./api/api";
import { Container } from "./container";
import { gitApi, GitApiRepository } from "./git/git";
import { Logger } from "./logger";
import { MarkerHandler } from "./marker/markerHandler";
import { Disposables, memoize } from "./system";
import {
	PubnubReceiver,
	PubnubInitializer,
	ChannelDescriptor,
	StatusChangeEvent,
	PubnubStatus
} from "./pubnub/pubnubReceiver";

// TODO: Fix this, but for now keep in sync with CodeStreamAgentOptions in agentClient.ts in vscode-codestream
export interface CodeStreamAgentOptions {
	extensionVersion: string;
	gitPath: string;
	ideVersion: string;

	serverUrl: string;
	email: string;
	team: string;
	teamId: string;
	token: string;
}

export class CodeStreamAgent implements Disposable, LSPLogger {
	private _clientCapabilities: ClientCapabilities | undefined;
	private readonly _connection: Connection;
	private _disposable: Disposable | undefined;
	private _pubnubReceiver: PubnubReceiver;

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

		this._pubnubReceiver = new PubnubReceiver();
	}

	dispose() {
		this._disposable && this._disposable.dispose();
	}

	private async onInitialize(e: InitializeParams) {
		const capabilities = e.capabilities;
		this._clientCapabilities = capabilities;

		const options = e.initializationOptions! as CodeStreamAgentOptions;
		const api = new CodeStreamApi(
			this,
			options.serverUrl,
			options.ideVersion,
			options.extensionVersion
		);
		const loginResponse = await api.login(options.email, options.token);

		// TODO: Since the token is current a password, replace it with an access token
		options.token = loginResponse.accessToken;

		// If there is only 1 team, use it regardless of config
		if (loginResponse.teams.length === 1) {
			options.teamId = loginResponse.teams[0].id;
		} else {
			// Sort the teams from oldest to newest
			loginResponse.teams.sort((a, b) => a.createdAt - b.createdAt);
		}

		if (options.teamId == null) {
			if (options.team) {
				const normalizedTeamName = options.team.toLocaleUpperCase();
				const team = loginResponse.teams.find(
					t => t.name.toLocaleUpperCase() === normalizedTeamName
				);
				if (team != null) {
					options.teamId = team.id;
				}
			}

			// if (opts.teamId == null && data.repos.length > 0) {
			// 	for (const repo of await Container.git.getRepositories()) {
			// 		const url = await repo.getNormalizedUrl();

			// 		const found = data.repos.find(r => r.normalizedUrl === url);
			// 		if (found === undefined) continue;

			// 		teamId = found.teamId;
			// 		break;
			// 	}
			// }

			// If we still can't find a team, then just pick the first one
			if (options.teamId == null) {
				options.teamId = loginResponse.teams[0].id;
			}
		}

		if (loginResponse.teams.find(t => t.id === options.teamId) === undefined) {
			options.teamId = loginResponse.teams[0].id;
		}

		void (await Container.initialize(this, this._connection, api, options, loginResponse));

		this.initializePubnub(loginResponse);

		return {
			capabilities: {
				textDocumentSync: TextDocumentSyncKind.Full,
				hoverProvider: true
			},
			result: {
				loginResponse: { ...loginResponse },
				state: { ...Container.instance().state }
			}
		} as InitializeResult;
	}

	private async onInitialized(e: InitializedParams) {
		try {
			// const repos = await this._connection.sendRequest<GitApiRepository[]>("codeStream/git/repos");

			gitApi({
				getGitPath: async () => Container.instance().gitPath,
				getRepositories: async () =>
					this._connection.sendRequest<GitApiRepository[]>("codeStream/git/repos")
			});

			const subscriptions = [];

			if (this.supportsConfiguration) {
				// Register for all configuration changes
				subscriptions.push(
					await this._connection.client.register(DidChangeConfigurationNotification.type, undefined)
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

			this._disposable = Disposables.from(...subscriptions);
		} catch (ex) {
			debugger;
			Logger.error(ex);
			throw ex;
		}
	}

	private async onConfigurationChanged(e: DidChangeConfigurationParams) {
		Container.instance().updateConfig(e.settings.codestream);
	}

	private initializePubnub (loginResponse: LoginResponse) {
		const channels: Array<ChannelDescriptor> = (loginResponse.teams || []).map(team => {
			return {
				name: `team-${team.id}`,
				withPresence: true
			} as ChannelDescriptor;
		});
		channels.push({ name: `user-${loginResponse.user.id}` } as ChannelDescriptor);

		this._pubnubReceiver.initialize({
			subscribeKey: loginResponse.pubnubKey,
			authKey: loginResponse.pubnubToken,
			userId: loginResponse.user.id,
			online: true
		} as PubnubInitializer);

		this._pubnubReceiver.onStatusChange(this.onPubnubStatusChange.bind(this));
		this._pubnubReceiver.onMessagesReceived(this.onPubnubMessages.bind(this));
		this._pubnubReceiver.subscribe(channels);
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

	private onPubnubStatusChange(e: StatusChangeEvent) {
		switch (e.status) {
			case PubnubStatus.Connected:
				// TODO: let the extension know we are connected?
				break;

			case PubnubStatus.Trouble:
				// TODO: let the extension know we have trouble?
				break;

			case PubnubStatus.Reset:
				// TODO: must fetch all data fetch from the server
				break;

			case PubnubStatus.Offline:
				// TODO: let the extension know we are offline?
				break;

			case PubnubStatus.SomeFailed:
				// TODO: let the extension know we have trouble?
				// the indicated channels have not been subscribed to, what do we do?
				break;

			case PubnubStatus.Failed:
				// TODO: catastrophic failure event, what do we do?
				break;
		}
	}

	private onPubnubMessages(messages: Array<any>) {
		// TODO: do something with these messages...
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
