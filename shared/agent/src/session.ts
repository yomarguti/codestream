"use strict";
import {
	CancellationToken,
	Connection,
	Emitter,
	Event,
	MessageActionItem
} from "vscode-languageserver";
import URI from "vscode-uri";
import { CodeStreamAgent } from "./agent";
import { AgentError, ServerError } from "./agentError";
import { CodeStreamApi } from "./api/api";
import { ApiProvider, LoginOptions } from "./api/apiProvider";
import { CodeStreamApiProvider } from "./api/codestreamApi";
import {
	VersionCompatibilityChangedEvent,
	VersionMiddlewareManager
} from "./api/middleware/versionMiddleware";
import { UserCollection } from "./api/models/users";
import { Container } from "./container";
import { setGitPath } from "./git/git";
import { Logger } from "./logger";
import { RealTimeMessage } from "./managers/realTimeMessage";
import { MarkerHandler } from "./marker/markerHandler";
import { MarkerLocationManager } from "./markerLocation/markerLocationManager";
import { PostHandler } from "./post/postHandler";
import { PubnubReceiver } from "./pubnub/pubnubReceiver";
import {
	AgentOptions,
	ApiRequestType,
	CreatePostWithCodeRequestType,
	DidChangeItemsNotificationType,
	DidChangeVersionCompatibilityNotificationType,
	DocumentFromCodeBlockRequestType,
	DocumentLatestRevisionRequestType,
	DocumentMarkersRequestType,
	FetchMarkerLocationsRequest,
	FetchMarkerLocationsRequestType,
	FetchMarkerLocationsResponse,
	GetMarkerRequest,
	GetMarkerRequestType,
	GetMarkerResponse,
	LogoutReason,
	LogoutRequestType,
	MessageType,
	PreparePostWithCodeRequestType
} from "./shared/agent.protocol";
import {
	ApiErrors,
	CSMarker,
	CSMarkerLocations,
	CSPost,
	CSRepository,
	CSStream,
	CSTeam,
	CSUser,
	LoginResult,
	StreamType
} from "./shared/api.protocol";
import { Strings } from "./system";

const loginApiErrorMappings: { [k: string]: ApiErrors } = {
	"USRC-1001": ApiErrors.InvalidCredentials,
	"USRC-1010": ApiErrors.NotConfirmed,
	"AUTH-1002": ApiErrors.InvalidToken,
	"AUTH-1003": ApiErrors.InvalidToken,
	"AUTH-1005": ApiErrors.InvalidToken,
	// "RAPI-1001": "missing parameter" // shouldn't ever happen
	"RAPI-1003": ApiErrors.NotFound,
	"USRC-1012": ApiErrors.NotOnTeam
};

export class CodeStreamSession {
	private _onDidChangePosts = new Emitter<CSPost[]>();
	get onDidChangePosts(): Event<CSPost[]> {
		return this._onDidChangePosts.event;
	}

	private _onDidChangeRepos = new Emitter<CSRepository[]>();
	get onDidChangeRepos(): Event<CSRepository[]> {
		return this._onDidChangeRepos.event;
	}

	private _onDidChangeStreams = new Emitter<CSStream[]>();
	get onDidChangeStreams(): Event<CSStream[]> {
		return this._onDidChangeStreams.event;
	}

	private _onDidChangeUsers = new Emitter<CSUser[]>();
	get onDidChangeUsers(): Event<CSUser[]> {
		return this._onDidChangeUsers.event;
	}

	private _onDidChangeTeams = new Emitter<CSTeam[]>();
	get onDidChangeTeams(): Event<CSTeam[]> {
		return this._onDidChangeTeams.event;
	}

	private _onDidChangeMarkers = new Emitter<CSMarker[]>();
	get onDidChangeMarkers(): Event<CSMarker[]> {
		return this._onDidChangeMarkers.event;
	}

	private _onDidChangeMarkerLocations = new Emitter<CSMarker[]>();
	get onDidChangeMarkerLocations(): Event<CSMarker[]> {
		return this._onDidChangeMarkerLocations.event;
	}

	private readonly _api: CodeStreamApi;
	private readonly _api2: ApiProvider;
	private readonly _readyPromise: Promise<void>;

	private _pubnub: PubnubReceiver | undefined;
	get pubnub() {
		return this._pubnub!;
	}

	constructor(
		public readonly agent: CodeStreamAgent,
		public readonly connection: Connection,
		private readonly _options: AgentOptions
	) {
		this._api = new CodeStreamApi(
			_options.serverUrl,
			_options.ideVersion,
			_options.extensionVersion,
			_options.extensionBuild
		);

		this._api2 = new CodeStreamApiProvider(_options.serverUrl, {
			ideVersion: _options.ideVersion,
			extensionVersion: _options.extensionVersion,
			extensionBuild: _options.extensionBuild
		});

		const versionManager = new VersionMiddlewareManager(this._api2);
		versionManager.onDidChangeCompatibility(this.onVersionCompatibilityChanged, this);

		this._readyPromise = new Promise<void>(resolve => this.agent.onReady(resolve));
		// this.connection.onHover(e => MarkerHandler.onHover(e));

		this.agent.registerHandler(ApiRequestType, (e, cancellationToken: CancellationToken) =>
			this._api2.fetch(e.url, e.init, e.token)
		);
		this.agent.registerHandler(
			DocumentFromCodeBlockRequestType,
			MarkerHandler.documentFromCodeBlock
		);
		this.agent.registerHandler(DocumentMarkersRequestType, MarkerHandler.documentMarkers);
		this.agent.registerHandler(PreparePostWithCodeRequestType, PostHandler.documentPreparePost);
		this.agent.registerHandler(CreatePostWithCodeRequestType, PostHandler.documentPost);

		this.agent.registerHandler(DocumentLatestRevisionRequestType, async e => {
			const revision = await Container.instance().git.getFileCurrentRevision(
				URI.parse(e.textDocument.uri)
			);
			return { revision: revision };
		});

		this.agent.registerHandler(GetMarkerRequestType, this.handleGetMarker);
		this.agent.registerHandler(FetchMarkerLocationsRequestType, this.handleFetchMarkerLocations);
	}

	private async onRealTimeMessageReceived(e: RealTimeMessage) {
		switch (e.type) {
			case MessageType.Posts:
				const posts = await Container.instance().posts.resolve(e);
				this._onDidChangePosts.fire(posts);
				this.agent.sendNotification(DidChangeItemsNotificationType, {
					type: MessageType.Posts,
					posts
				});
				break;
			case MessageType.Repositories:
				const repos = await Container.instance().repos.resolve(e);
				this._onDidChangeRepos.fire(repos);
				this.agent.sendNotification(DidChangeItemsNotificationType, {
					type: MessageType.Repositories,
					repos
				});
				break;
			case MessageType.Streams:
				const streams = await Container.instance().streams.resolve(e);
				this._onDidChangeStreams.fire(streams);
				this.agent.sendNotification(DidChangeItemsNotificationType, {
					type: MessageType.Streams,
					streams
				});
				break;
			case MessageType.Users:
				const users = await Container.instance().users.resolve(e);
				this._onDidChangeUsers.fire(users);
				this.agent.sendNotification(DidChangeItemsNotificationType, {
					type: MessageType.Users,
					users
				});
				break;
			case MessageType.Teams:
				const teams = await Container.instance().teams.resolve(e);
				this._onDidChangeTeams.fire(teams);
				this.agent.sendNotification(DidChangeItemsNotificationType, {
					type: MessageType.Teams,
					teams
				});
				break;
			case MessageType.Markers:
				const markers = await Container.instance().markers.resolve(e);
				this._onDidChangeMarkers.fire(markers);
				this.agent.sendNotification(DidChangeItemsNotificationType, {
					type: MessageType.Markers,
					markers
				});
				break;
			case MessageType.MarkerLocations:
				// const markerLocations = await Container.instance().markerLocations.resolve(e);
				// this._onDidChangeMarkerLocations.fire(markerLocations);
				// this.agent.sendNotification(DidEntitiesChangeNotificationType, {
				// 	type: MessageType.MarkerLocations,
				// 	markerLocations
				// });
				break;
		}
	}

	private onVersionCompatibilityChanged(e: VersionCompatibilityChangedEvent) {
		this.agent.sendNotification(DidChangeVersionCompatibilityNotificationType, e);
	}

	private _apiToken: string | undefined;
	get apiToken() {
		return this._apiToken!;
	}

	private _teamId: string | undefined;
	get teamId() {
		return this._teamId!;
	}

	private _userId: string | undefined;
	get userId() {
		return this._userId!;
	}

	private _users: UserCollection | undefined;
	get users() {
		if (this._users === undefined) {
			this._users = new UserCollection(this);
		}
		return this._users;
	}

	get workspace() {
		return this.connection.workspace;
	}

	async ready() {
		return this._readyPromise;
	}

	async login() {
		const { email, passwordOrToken, serverUrl, signupToken } = this._options;
		if (!signupToken && typeof passwordOrToken !== "string") {
			if (passwordOrToken.email !== email || passwordOrToken.url !== serverUrl) {
				throw new AgentError("Invalid credentials.");
			}
		}

		const start = process.hrtime();

		try {
			let opts: LoginOptions;
			if (signupToken) {
				opts = { type: "otc", code: signupToken };
			} else if (typeof passwordOrToken === "string") {
				opts = {
					type: "credentials",
					email: email,
					password: passwordOrToken
				};
			} else {
				opts = {
					type: "token",
					token: passwordOrToken
				};
			}

			let response;
			try {
				response = await this._api2.login(opts);
			} catch (ex) {
				if (ex instanceof ServerError) {
					if (ex.statusCode !== undefined && ex.statusCode >= 400 && ex.statusCode < 500) {
						return {
							error: loginApiErrorMappings[ex.info.code] || LoginResult.Unknown
						};
					}
				}

				throw AgentError.wrap(ex, `Login failed:\n${ex.message}`);
			}

			this._apiToken = response.accessToken;
			this._options.passwordOrToken = {
				url: serverUrl,
				email: email,
				value: response.accessToken
			};
			this._teamId = this._options.teamId = response.teamId;
			this._userId = response.user.id;

			setGitPath(this._options.gitPath);
			void (await Container.initialize(this, this._api, this._api2, this._options, response));

			this._pubnub = new PubnubReceiver(
				this.agent,
				this._api,
				response.pubnubKey,
				response.pubnubToken,
				this._apiToken,
				this._userId,
				this._teamId
			);

			const streams = await this.getSubscribableStreams(this._userId, this._teamId);
			this._pubnub.listen(streams.map(s => s.id));
			this._pubnub.onDidReceiveMessage(this.onRealTimeMessageReceived, this);
			const { git, repos } = Container.instance();
			git.onRepositoryCommitHashChanged(repo => {
				MarkerLocationManager.flushUncommittedLocations(repo);
			});

			return {
				loginResponse: { ...response },
				state: { ...Container.instance().state }
			};
		} finally {
			Logger.log(`Login completed in ${Strings.getDurationMilliseconds(start)} ms`);
		}
	}

	logout(reason?: LogoutReason) {
		return this.agent.sendRequest(LogoutRequestType, { reason: reason });
	}

	showErrorMessage<T extends MessageActionItem>(message: string, ...actions: T[]) {
		return this.connection.window.showErrorMessage(message, ...actions);
	}

	showInformationMessage<T extends MessageActionItem>(message: string, ...actions: T[]) {
		return this.connection.window.showInformationMessage(message, ...actions);
	}

	showWarningMessage<T extends MessageActionItem>(message: string, ...actions: T[]) {
		return this.connection.window.showWarningMessage(message, ...actions);
	}

	private async getSubscribableStreams(userId: string, teamId?: string): Promise<CSStream[]> {
		return (await this._api2.fetchStreams({
			types: [StreamType.Channel, StreamType.Direct]
		})).streams.filter(s => CodeStreamApi.isStreamSubscriptionRequired(s, userId));
	}

	handleGetMarker(request: GetMarkerRequest): Promise<GetMarkerResponse> {
		return this._api.getMarker(this.apiToken, this.teamId, request.markerId);
	}

	handleFetchMarkerLocations(
		request: FetchMarkerLocationsRequest
	): Promise<FetchMarkerLocationsResponse> {
		return this._api.getMarkerLocations(
			this.apiToken,
			this.teamId,
			request.streamId,
			request.commitHash
		);
	}
}
