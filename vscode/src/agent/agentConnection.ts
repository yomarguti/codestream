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
	window,
	workspace
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
import { BuiltInCommands } from "../commands";
import { extensionQualifiedId } from "../constants";
import { Container } from "../container";
import { Logger } from "../logger";
import {
	AccessToken,
	AgentInitializeResult,
	AgentOptions,
	AgentResult,
	ApiRequestType,
	ArchiveStreamRequestType,
	BaseAgentOptions,
	CloseStreamRequestType,
	CodeStreamEnvironment,
	CreateChannelStreamRequestType,
	CreateDirectStreamRequestType,
	CreatePostRequestType,
	CreatePostResponse,
	CreatePostWithMarkerRequestType,
	CreateRepoRequestType,
	DeletePostRequestType,
	DidChangeConnectionStatusNotification,
	DidChangeConnectionStatusNotificationType,
	DidChangeDataNotification,
	DidChangeDataNotificationType,
	DidChangeDocumentMarkersNotification,
	DidChangeDocumentMarkersNotificationType,
	DidChangeVersionCompatibilityNotification,
	DidChangeVersionCompatibilityNotificationType,
	DidLogoutNotification,
	DidLogoutNotificationType,
	DocumentFromCodeBlockRequestType,
	DocumentFromCodeBlockResponse,
	DocumentFromMarkerRequestType,
	DocumentFromMarkerResponse,
	DocumentLatestRevisionRequestType,
	DocumentLatestRevisionResponse,
	DocumentMarkersRequestType,
	EditPostRequestType,
	FetchCodemarksRequestType,
	FetchFileStreamsRequestType,
	FetchMarkerLocationsRequestType,
	FetchPostRepliesRequestType,
	FetchPostsRequestType,
	FetchReposRequestType,
	FetchStreamsRequestType,
	FetchTeamsRequestType,
	FetchUnreadStreamsRequestType,
	FetchUsersRequestType,
	GetMarkerRequestType,
	GetMeRequestType,
	GetPostRequestType,
	GetPreferencesRequestType,
	GetRepoRequestType,
	GetStreamRequestType,
	GetTeamRequestType,
	GetUnreadsRequestType,
	GetUserRequestType,
	InviteUserRequestType,
	JoinStreamRequestType,
	LeaveStreamRequestType,
	MarkPostUnreadRequestType,
	MarkStreamReadRequestType,
	MuteStreamRequestType,
	OpenStreamRequestType,
	PreparePostWithCodeRequestType,
	ReactToPostRequestType,
	RenameStreamRequestType,
	ReportErrorRequestType,
	SetPostStatusRequestType,
	SetStreamPurposeRequestType,
	UnarchiveStreamRequestType,
	UpdateCodemarkRequestType,
	UpdatePreferencesRequestType,
	UpdatePresenceRequestType,
	UpdateStreamMembershipRequestType,
	UpdateStreamMembershipResponse,
	VersionCompatibility
} from "../shared/agent.protocol";
import {
	ChannelServiceType,
	CodemarkType,
	CSMarker,
	CSMePreferences,
	CSPost,
	CSPresenceStatus,
	StreamType
} from "../shared/api.protocol";
import { log } from "../system";

export * from "../shared/agent.protocol";
export * from "../shared/api.protocol";

export interface DocumentMarkersChangedEvent {
	uri: Uri;
}

export class CodeStreamAgentConnection implements Disposable {
	private _onDidChangeDocumentMarkers = new EventEmitter<DocumentMarkersChangedEvent>();
	get onDidChangeDocumentMarkers(): Event<DocumentMarkersChangedEvent> {
		return this._onDidChangeDocumentMarkers.event;
	}

	private _onDidChangeData = new EventEmitter<DidChangeDataNotification>();
	get onDidChangeData(): Event<DidChangeDataNotification> {
		return this._onDidChangeData.event;
	}

	private _client: LanguageClient | undefined;
	private _disposable: Disposable | undefined;

	private _clientOptions: LanguageClientOptions;
	private _serverOptions: ServerOptions;

	constructor(context: ExtensionContext, options: BaseAgentOptions) {
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
			]
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
		return this.sendRequest(ApiRequestType, {
			url: url,
			init: init,
			token: token
		});
	}

	@started
	getDocumentFromMarker(marker: CSMarker): Promise<DocumentFromMarkerResponse | undefined> {
		return this.sendRequest(DocumentFromMarkerRequestType, {
			repoId: marker.repoId,
			file: marker.file,
			markerId: marker.id
		});
	}

	@started
	async getLatestRevision(uri: Uri): Promise<DocumentLatestRevisionResponse> {
		return this.sendRequest(DocumentLatestRevisionRequestType, {
			textDocument: { uri: uri.toString() }
		});
	}

	@started
	async reportError(message: string, source: "webview" | "extension", extra?: object) {
		this.sendRequest(ReportErrorRequestType, { source, message, extra });
	}

	async login(
		serverUrl: string,
		email: string,
		passwordOrToken: string | AccessToken,
		teamId?: string,
		team?: string
	): Promise<AgentResult> {
		const options: Required<AgentOptions> = {
			...this._clientOptions.initializationOptions,
			serverUrl: serverUrl,
			traceLevel: Logger.level,
			email: email,
			passwordOrToken: passwordOrToken,
			team,
			teamId
		};

		const httpSettings = workspace.getConfiguration("http");
		const proxy = httpSettings.get<string | undefined>("proxy", "");
		if (proxy) {
			options.proxy = {
				url: proxy,
				strictSSL: httpSettings.get<boolean>("proxyStrictSSL", true)
			};
		}

		const response = await this.start(options);

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
	get markers() {
		return this._markers;
	}

	private readonly _markers = new class {
		constructor(private readonly _connection: CodeStreamAgentConnection) {}

		fetch(uri: Uri) {
			return this._connection.sendRequest(DocumentMarkersRequestType, {
				textDocument: { uri: uri.toString() }
			});
		}

		get(markerId: string) {
			return this._connection.sendRequest(GetMarkerRequestType, { markerId: markerId });
		}

		fetchLocations(streamId: string, commitHash: string) {
			return this._connection.sendRequest(FetchMarkerLocationsRequestType, {
				streamId: streamId,
				commitHash: commitHash
			});
		}
	}(this);

	@started
	get codemarks() {
		return this._codemarks;
	}

	private readonly _codemarks = new class {
		constructor(private readonly _connection: CodeStreamAgentConnection) {}

		fetch() {
			return this._connection.sendRequest(FetchCodemarksRequestType, {});
		}

		edit(codemarkId: string, attributes: { color?: string }) {
			return this._connection.sendRequest(UpdateCodemarkRequestType, { codemarkId, ...attributes });
		}
	}(this);

	@started
	get posts() {
		return this._posts;
	}

	private readonly _posts = new class {
		constructor(private readonly _connection: CodeStreamAgentConnection) {}

		create(
			streamId: string,
			text: string,
			mentionedUserIds?: string[],
			parentPostId?: string,
			title?: string,
			type?: CodemarkType,
			assignees?: [],
			color?: string
		) {
			let codemark;
			if (type || title || assignees || color) {
				codemark = {
					title: title,
					type: type || CodemarkType.Comment,
					assignees: assignees,
					color: color
				};
			}

			return this._connection.sendRequest(CreatePostRequestType, {
				streamId: streamId,
				text: text,
				mentionedUserIds: mentionedUserIds,
				parentPostId: parentPostId,
				codemark: codemark
			});
		}

		createWithCode(
			uri: Uri,
			// document: TextDocument,
			// range: Range,
			text: string,
			mentionedUserIds: string[],
			code: string,
			rangeArray: [number, number, number, number] | undefined,
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
			streamId: string,
			title?: string,
			type?: CodemarkType,
			assignees?: [],
			color?: string
		): Promise<CreatePostResponse> {
			return this._connection.sendRequest(CreatePostWithMarkerRequestType, {
				textDocument: { uri: uri.toString() },
				// range: range,
				// dirty: document.isDirty,
				mentionedUserIds: mentionedUserIds,
				text: text,
				code: code,
				rangeArray: rangeArray,
				source: source,
				parentPostId: parentPostId,
				streamId: streamId,
				title: title,
				type: type || CodemarkType.Comment,
				assignees: assignees,
				color: color
			});
		}

		fetch(
			streamId: string,
			options: {
				limit?: number;
				before?: number | string;
				after?: number | string;
				inclusive?: boolean;
			} = {}
		) {
			return this._connection.sendRequest(FetchPostsRequestType, {
				streamId: streamId,
				...options
			});
		}

		// fetchByRange(streamId: string, start: number, end: number) {
		// 	return this.fetch(streamId, {
		// 		before: end,
		// 		after: start,
		// 		inclusive: true
		// 	});
		// }

		// async fetchLatest(streamId: string) {
		// 	const response = await this.fetch(streamId, { limit: 1 });
		// 	return { post: response.posts[0] };
		// }

		fetchReplies(streamId: string, parentPostId: string) {
			return this._connection.sendRequest(FetchPostRepliesRequestType, {
				streamId: streamId,
				postId: parentPostId
			});
		}

		get(streamId: string, postId: string) {
			return this._connection.sendRequest(GetPostRequestType, {
				streamId: streamId,
				postId: postId
			});
		}

		delete(streamId: string, postId: string) {
			return this._connection.sendRequest(DeletePostRequestType, {
				postId: postId,
				streamId: streamId
			});
		}

		edit(streamId: string, postId: string, text: string, mentionedUserIds?: string[]) {
			return this._connection.sendRequest(EditPostRequestType, {
				postId: postId,
				streamId: streamId,
				text: text,
				mentionedUserIds: mentionedUserIds
			});
		}

		markUnread(streamId: string, postId: string) {
			return this._connection.sendRequest(MarkPostUnreadRequestType, {
				postId: postId,
				streamId: streamId
			});
		}

		prepareCode(document: TextDocument, range: Range) {
			return this._connection.sendRequest(PreparePostWithCodeRequestType, {
				textDocument: { uri: document.uri.toString() },
				range: range,
				dirty: document.isDirty
			});
		}

		react(streamId: string, postId: string, reactions: { [emoji: string]: boolean }) {
			return this._connection.sendRequest(ReactToPostRequestType, {
				postId: postId,
				streamId: streamId,
				emojis: reactions
			});
		}

		setStatus(streamId: string, postId: string, status: string) {
			return this._connection.sendRequest(SetPostStatusRequestType, {
				postId: postId,
				streamId: streamId,
				status: status
			});
		}
	}(this);

	@started
	get repos() {
		return this._repos;
	}

	private readonly _repos = new class {
		constructor(private readonly _connection: CodeStreamAgentConnection) {}

		create(url: string, knownCommitHashes: string[]) {
			return this._connection.sendRequest(CreateRepoRequestType, {
				url: url,
				knownCommitHashes: knownCommitHashes
			});
		}

		fetch() {
			return this._connection.sendRequest(FetchReposRequestType, {});
		}

		get(repoId: string) {
			return this._connection.sendRequest(GetRepoRequestType, {
				repoId: repoId
			});
		}
	}(this);

	@started
	get streams() {
		return this._streams;
	}

	private readonly _streams = new class {
		constructor(private readonly _connection: CodeStreamAgentConnection) {}

		createChannel(
			name: string,
			membership?: "auto" | string[],
			privacy: "public" | "private" = membership === "auto" ? "public" : "private",
			purpose?: string,
			service?: {
				serviceType: ChannelServiceType;
				serviceKey?: string;
				serviceInfo?: { [key: string]: any };
			}
		) {
			return this._connection.sendRequest(CreateChannelStreamRequestType, {
				type: StreamType.Channel,
				name: name,
				memberIds: membership === "auto" ? undefined : membership,
				isTeamStream: membership === "auto",
				privacy: membership === "auto" ? "public" : privacy,
				purpose: purpose,
				...service
			});
		}

		createDirect(membership: string[]) {
			return this._connection.sendRequest(CreateDirectStreamRequestType, {
				type: StreamType.Direct,
				memberIds: membership
			});
		}

		fetch(types?: (StreamType.Channel | StreamType.Direct)[]) {
			return this._connection.sendRequest(FetchStreamsRequestType, { types: types });
		}

		fetchFiles(repoId: string) {
			return this._connection.sendRequest(FetchFileStreamsRequestType, { repoId: repoId });
		}

		fetchUnread() {
			return this._connection.sendRequest(FetchUnreadStreamsRequestType, {});
		}

		get(streamId: string) {
			return this._connection.sendRequest(GetStreamRequestType, {
				streamId: streamId
			});
		}

		archive(streamId: string) {
			return this._connection.sendRequest(ArchiveStreamRequestType, {
				streamId: streamId
			});
		}

		close(streamId: string) {
			return this._connection.sendRequest(CloseStreamRequestType, {
				streamId: streamId
			});
		}

		invite(streamId: string, userId: string): Promise<UpdateStreamMembershipResponse>;
		invite(streamId: string, userIds: string[]): Promise<UpdateStreamMembershipResponse>;
		invite(streamId: string, userIds: string | string[]) {
			if (typeof userIds === "string") {
				userIds = [userIds];
			}
			return this._connection.sendRequest(UpdateStreamMembershipRequestType, {
				streamId: streamId,
				add: userIds
			});
		}

		join(streamId: string) {
			return this._connection.sendRequest(JoinStreamRequestType, {
				streamId: streamId
			});
		}

		kick(streamId: string, userId: string): Promise<UpdateStreamMembershipResponse>;
		kick(streamId: string, userIds: string[]): Promise<UpdateStreamMembershipResponse>;
		kick(streamId: string, userIds: string | string[]) {
			if (typeof userIds === "string") {
				userIds = [userIds];
			}
			return this._connection.sendRequest(UpdateStreamMembershipRequestType, {
				streamId: streamId,
				remove: userIds
			});
		}

		leave(streamId: string) {
			return this._connection.sendRequest(LeaveStreamRequestType, {
				streamId: streamId
			});
		}

		markRead(streamId: string, postId?: string) {
			return this._connection.sendRequest(MarkStreamReadRequestType, {
				streamId: streamId,
				postId: postId
			});
		}

		mute(streamId: string, mute: boolean) {
			return this._connection.sendRequest(MuteStreamRequestType, {
				streamId: streamId,
				mute: mute
			});
		}

		open(streamId: string) {
			return this._connection.sendRequest(OpenStreamRequestType, {
				streamId: streamId
			});
		}

		rename(streamId: string, name: string) {
			return this._connection.sendRequest(RenameStreamRequestType, {
				streamId: streamId,
				name: name
			});
		}

		setPurpose(streamId: string, purpose: string) {
			return this._connection.sendRequest(SetStreamPurposeRequestType, {
				streamId: streamId,
				purpose: purpose
			});
		}

		unarchive(streamId: string) {
			return this._connection.sendRequest(UnarchiveStreamRequestType, {
				streamId: streamId
			});
		}
	}(this);

	@started
	get teams() {
		return this._teams;
	}

	private readonly _teams = new class {
		constructor(private readonly _connection: CodeStreamAgentConnection) {}

		fetch(teamIds?: string[]) {
			return this._connection.sendRequest(FetchTeamsRequestType, {
				mine: teamIds == null,
				teamIds: teamIds
			});
		}

		get(teamId: string) {
			return this._connection.sendRequest(GetTeamRequestType, {
				teamId: teamId
			});
		}
	}(this);

	@started
	get users() {
		return this._users;
	}

	private readonly _users = new class {
		constructor(private readonly _connection: CodeStreamAgentConnection) {}

		fetch() {
			return this._connection.sendRequest(FetchUsersRequestType, {});
		}

		get(userId: string) {
			return this._connection.sendRequest(GetUserRequestType, {
				userId: userId
			});
		}

		invite(email: string, fullName?: string) {
			return this._connection.sendRequest(InviteUserRequestType, {
				email: email,
				fullName: fullName
			});
		}

		me() {
			return this._connection.sendRequest(GetMeRequestType, {});
		}

		updatePresence(status: CSPresenceStatus) {
			return this._connection.sendRequest(UpdatePresenceRequestType, {
				sessionId: Container.session.id,
				status: status
			});
		}

		updatePreferences(preferences: CSMePreferences) {
			return this._connection.sendRequest(UpdatePreferencesRequestType, {
				preferences: preferences
			});
		}

		unreads() {
			return this._connection.sendRequest(GetUnreadsRequestType, {});
		}

		preferences() {
			return this._connection.sendRequest(GetPreferencesRequestType, undefined);
		}
	}(this);

	@log({
		prefix: (context, e: DidChangeConnectionStatusNotification) => `${context.prefix}(${e.status})`
	})
	private onConnectionStatusChanged(e: DidChangeConnectionStatusNotification) {
		Container.webview.setConnectionStatus(e.status, e.reset);
	}

	@log({
		prefix: (context, e: DidChangeDocumentMarkersNotification) =>
			`${context.prefix}(${e.textDocument.uri})`
	})
	private onDocumentMarkersChanged(e: DidChangeDocumentMarkersNotification) {
		this._onDidChangeDocumentMarkers.fire({ uri: Uri.parse(e.textDocument.uri) });
	}

	@log({
		prefix: (context, ...messages: DidChangeDataNotification[]) =>
			`${context.prefix}(${messages.map(m => m.type).join(", ")})`
	})
	private async onDataChanged(...messages: DidChangeDataNotification[]) {
		for (const message of messages) {
			Logger.debug(`\tAgentConnection.onDataChanged(${message.type})`, message.data);
			this._onDidChangeData.fire(message);
		}
	}

	@log()
	private onLogout(e: DidLogoutNotification) {
		void Container.session.goOffline();
	}

	@log()
	private async onVersionCompatibilityChanged(e: DidChangeVersionCompatibilityNotification) {
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
		const traceParams =
			type.method === ApiRequestType.method ? params.init && params.init.body : params;

		try {
			Logger.logWithDebugParams(
				`AgentConnection.sendRequest(${type.method})${
					type.method === ApiRequestType.method ? `: ${params.url}` : ""
				}`,
				traceParams
			);
			const response = await this._client!.sendRequest(type, params);
			return response;
		} catch (ex) {
			Logger.error(ex, `AgentConnection.sendRequest(${type.method})`, traceParams);
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

		this._disposable = this._client.start();
		void (await this._client.onReady());

		this._client.onNotification(DidChangeDataNotificationType, this.onDataChanged.bind(this));
		this._client.onNotification(
			DidChangeConnectionStatusNotificationType,
			this.onConnectionStatusChanged.bind(this)
		);
		this._client.onNotification(
			DidChangeDocumentMarkersNotificationType,
			this.onDocumentMarkersChanged.bind(this)
		);
		this._client.onNotification(
			DidChangeVersionCompatibilityNotificationType,
			this.onVersionCompatibilityChanged.bind(this)
		);
		this._client.onNotification(DidLogoutNotificationType, this.onLogout.bind(this));
		// this._client.onNotification(DidResetNotificationType, this.onReset.bind(this));

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
