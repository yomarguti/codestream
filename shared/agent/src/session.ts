"use strict";
import {
	CancellationToken,
	Connection,
	Emitter,
	Event,
	MessageActionItem
} from "vscode-languageserver";
import URI from "vscode-uri";
import {
	AgentOptions,
	ApiRequestType,
	CodeStreamAgent,
	CreateChannelStreamRequest,
	CreateDirectStreamRequest,
	CreatePostRequest,
	CreatePostRequestType,
	CreatePostResponse,
	CreatePostWithCodeRequestType,
	CreateRepoRequestType,
	DeletePostRequest,
	DeletePostRequestType,
	DocumentFromCodeBlockRequestType,
	DocumentLatestRevisionRequestType,
	DocumentMarkersRequestType,
	EditPostRequestType,
	FetchLatestPostRequest,
	FetchLatestPostRequestType,
	FetchLatestPostResponse,
	FetchMarkerLocationsRequest,
	FetchMarkerLocationsRequestType,
	FetchMarkerLocationsResponse,
	FetchPostsByRangeRequest,
	FetchPostsByRangeRequestType,
	FetchPostsByRangeResponse,
	FetchPostsRequestType,
	FetchReposRequest,
	FetchReposRequestType,
	FetchReposResponse,
	FetchStreamsRequest,
	FetchStreamsRequestType,
	FetchStreamsResponse,
	FetchTeamsRequest,
	FetchTeamsRequestType,
	FetchTeamsResponse,
	FetchUnreadStreamsRequest,
	FetchUnreadStreamsRequestType,
	FetchUnreadStreamsResponse,
	FetchUsersRequest,
	FetchUsersRequestType,
	FindRepoRequest,
	FindRepoRequestType,
	GetMarkerRequest,
	GetMarkerRequestType,
	GetMeRequest,
	GetMeRequestType,
	GetPostRequest,
	GetPostRequestType,
	GetRepoRequest,
	GetRepoRequestType,
	GetStreamRequest,
	GetStreamRequestType,
	GetStreamResponse,
	GetTeamRequest,
	GetTeamRequestType,
	GetUserRequest,
	GetUserRequestType,
	InviteUserRequestType,
	JoinStreamRequest,
	JoinStreamRequestType,
	JoinStreamResponse,
	MarkPostUnreadRequestType,
	MarkStreamReadRequest,
	MarkStreamReadRequestType,
	MarkStreamReadResponse,
	PreparePostWithCodeRequestType,
	ReactToPostRequestType,
	UpdatePreferencesRequest,
	UpdatePreferencesRequestType,
	UpdatePreferencesResponse,
	UpdatePresenceRequestType,
	UpdateStreamMembershipRequestType,
	UpdateStreamRequest,
	UpdateStreamRequestType,
	UpdateStreamResponse
} from "./agent";
import { AgentError, ServerError } from "./agentError";
import { ApiErrors, CodeStreamApi, CSRepository, CSStream, LoginResult } from "./api/api";
import { ApiProvider, LoginOptions } from "./api/apiProvider";
import { Cache } from "./api/cache";
import { CodeStreamApiProvider } from "./api/codestreamApi";
import {
	VersionCompatibilityChangedEvent,
	VersionMiddlewareManager
} from "./api/middleware/versionMiddleware";
import { UserCollection } from "./api/models/users";
import { Container } from "./container";
import { setGitPath } from "./git/git";
import { Logger } from "./logger";
import { MarkerHandler } from "./marker/markerHandler";
import { MarkerManager } from "./marker/markerManager";
import { MarkerLocationManager } from "./markerLocation/markerLocationManager";
import { PostHandler } from "./post/postHandler";
import { MessageReceivedEvent, MessageType, PubnubReceiver } from "./pubnub/pubnubReceiver";
import {
	CreateChannelStreamRequestType,
	CreateChannelStreamResponse,
	CreateDirectStreamRequestType,
	CreateDirectStreamResponse,
	CreateRepoRequest,
	CreateRepoResponse,
	DeletePostResponse,
	DidChangeVersionCompatibilityNotificationType,
	EditPostRequest,
	EditPostResponse,
	FetchFileStreamsRequest,
	FetchFileStreamsRequestType,
	FetchFileStreamsResponse,
	FetchPostRepliesRequestType,
	FetchUsersResponse,
	FindRepoResponse,
	GetMarkerResponse,
	GetMeResponse,
	GetPostResponse,
	GetRepoResponse,
	GetTeamResponse,
	GetUserResponse,
	InviteUserRequest,
	InviteUserResponse,
	LogoutReason,
	LogoutRequestType,
	MarkPostUnreadRequest,
	MarkPostUnreadResponse,
	ReactToPostRequest,
	ReactToPostResponse,
	UpdatePresenceRequest,
	UpdatePresenceResponse,
	UpdateStreamMembershipRequest,
	UpdateStreamMembershipResponse
} from "./shared/agent.protocol";
import { StreamManager } from "./stream/streamManager";
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

export class RepositoriesChangedEvent {
	constructor(public readonly session: CodeStreamSession, readonly entities: CSRepository[]) {}
}

export type SessionChangedEvent = RepositoriesChangedEvent;

export class CodeStreamSession {
	private _onDidChangeRepositories = new Emitter<RepositoriesChangedEvent>();
	get onDidChangeRepositories(): Event<RepositoriesChangedEvent> {
		return this._onDidChangeRepositories.event;
	}

	private readonly _api: CodeStreamApi;
	private readonly _api2: ApiProvider;
	private _pubnub: PubnubReceiver | undefined;
	private readonly _readyPromise: Promise<void>;

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
		this.agent.registerHandler(FetchPostsRequestType, PostHandler.getPosts);

		this.agent.registerHandler(DocumentLatestRevisionRequestType, async e => {
			const revision = await Container.instance().git.getFileCurrentRevision(
				URI.parse(e.textDocument.uri)
			);
			return { revision: revision };
		});

		this.agent.registerHandler(GetMeRequestType, r => this._api2.getMe());
		this.agent.registerHandler(InviteUserRequestType, r => this._api2.inviteUser(r));
		this.agent.registerHandler(UpdatePreferencesRequestType, r => this._api2.updatePreferences(r));
		this.agent.registerHandler(UpdatePresenceRequestType, r => this._api2.updatePresence(r));

		this.agent.registerHandler(GetMarkerRequestType, this.handleGetMarker);
		this.agent.registerHandler(FetchMarkerLocationsRequestType, this.handleFetchMarkerLocations);

		this.agent.registerHandler(CreatePostRequestType, r => this._api2.createPost(r));
		this.agent.registerHandler(DeletePostRequestType, r => this._api2.deletePost(r));
		this.agent.registerHandler(EditPostRequestType, r => this._api2.editPost(r));
		this.agent.registerHandler(FetchLatestPostRequestType, r => this._api2.fetchLatestPost(r));
		this.agent.registerHandler(FetchPostRepliesRequestType, r => this._api2.fetchPostReplies(r));
		this.agent.registerHandler(FetchPostsRequestType, r => this._api2.fetchPosts(r));
		this.agent.registerHandler(FetchPostsByRangeRequestType, r => this._api2.fetchPostsByRange(r));
		this.agent.registerHandler(GetPostRequestType, r => this._api2.getPost(r));
		this.agent.registerHandler(MarkPostUnreadRequestType, r => this._api2.markPostUnread(r));
		this.agent.registerHandler(ReactToPostRequestType, r => this._api2.reactToPost(r));

		this.agent.registerHandler(FindRepoRequestType, this.handleFindRepo);
		this.agent.registerHandler(GetRepoRequestType, this.handleGetRepo);
		this.agent.registerHandler(FetchReposRequestType, this.handleFetchRepos);

		this.agent.registerHandler(CreateChannelStreamRequestType, r =>
			this._api2.createChannelStream(r)
		);
		this.agent.registerHandler(CreateDirectStreamRequestType, r =>
			this._api2.createDirectStream(r)
		);
		this.agent.registerHandler(CreateRepoRequestType, r => this._api2.createRepo(r));

		this.agent.registerHandler(GetStreamRequestType, this.handleGetStream);
		this.agent.registerHandler(FetchUnreadStreamsRequestType, this.handleGetUnreadStreams);
		this.agent.registerHandler(FetchStreamsRequestType, this.handleGetStreams);
		this.agent.registerHandler(FetchFileStreamsRequestType, this.handleGetFileStreams);
		this.agent.registerHandler(GetTeamRequestType, this.handleGetTeam);
		this.agent.registerHandler(FetchTeamsRequestType, this.handleFetchTeams);
		this.agent.registerHandler(GetUserRequestType, this.handleGetUser);
		this.agent.registerHandler(FetchUsersRequestType, this.handleFetchUsers);
		this.agent.registerHandler(JoinStreamRequestType, this.handleJoinStream);
		this.agent.registerHandler(UpdateStreamRequestType, this.handleUpdateStream);
		this.agent.registerHandler(
			UpdateStreamMembershipRequestType,
			this.handleUpdateStreamMembership
		);
		this.agent.registerHandler(MarkStreamReadRequestType, this.handleMarkStreamRead);
	}

	private onMessageReceived(e: MessageReceivedEvent) {
		const { postManager, repoManager } = Container.instance();
		switch (e.type) {
			case MessageType.Posts:
				postManager.resolve(e.changeSets);
				break;
			case MessageType.Repositories:
				repoManager.resolve(e.changeSets);
				break;
			case MessageType.Streams:
				StreamManager.cacheStreams(e.streams);
				break;
			case MessageType.Users:
				break;
			case MessageType.Teams:
				break;
			case MessageType.Markers:
				MarkerManager.cacheMarkers(e.markers);
				break;
			case MessageType.MarkerLocations:
				MarkerLocationManager.cacheMarkerLocations(e.markerLocations);
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
			this._pubnub.onDidReceiveMessage(this.onMessageReceived, this);
			const { git, repoManager } = Container.instance();
			git.onRepositoryCommitHashChanged(repo => {
				MarkerLocationManager.flushUncommittedLocations(repo);
			});

			repoManager.onEntitiesChanged(entities => {
				this._onDidChangeRepositories.fire(new RepositoriesChangedEvent(this, entities));
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
		return (await this._api.getStreams<CSStream>(
			this._apiToken!,
			teamId || this._teamId!
		)).streams.filter(s => CodeStreamApi.isStreamSubscriptionRequired(s, userId));
	}

	handleFindRepo(request: FindRepoRequest): Promise<FindRepoResponse> {
		return this._api.findRepo(request.url, request.firstCommitHashes);
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

	async handleGetRepo(request: GetRepoRequest): Promise<GetRepoResponse> {
		const { repoManager } = Container.instance();
		const repo = await repoManager.get(request.repoId);
		return {
			repo
		};
	}

	async handleFetchRepos(request: FetchReposRequest): Promise<FetchReposResponse> {
		const { repoManager } = Container.instance();
		const repos = await repoManager.getAll();
		return {
			repos
		};
	}

	handleGetStream(request: GetStreamRequest): Promise<GetStreamResponse> {
		const { api, session } = Container.instance();
		return this._api.getStream(session.apiToken, session.teamId, request.id);
	}

	handleGetUnreadStreams(request: FetchUnreadStreamsRequest): Promise<FetchUnreadStreamsResponse> {
		const { api, session } = Container.instance();
		return this._api.getUnreadStreams(session.apiToken, session.teamId);
	}

	handleGetStreams(request: FetchStreamsRequest): Promise<FetchStreamsResponse> {
		const { api, session } = Container.instance();
		return this._api.getStreams(session.apiToken, session.teamId, request.types);
	}

	handleGetFileStreams(request: FetchFileStreamsRequest): Promise<FetchFileStreamsResponse> {
		const { api, session } = Container.instance();
		return this._api.getStreams(session.apiToken, session.teamId, undefined, request.repoId);
	}

	handleGetTeam(request: GetTeamRequest): Promise<GetTeamResponse> {
		const { api, session } = Container.instance();
		return this._api.getTeam(session.apiToken, request.teamId);
	}

	handleFetchTeams(request: FetchTeamsRequest): Promise<FetchTeamsResponse> {
		const { api, session } = Container.instance();
		return this._api.getTeams(session.apiToken, request.teamIds);
	}

	handleGetUser(request: GetUserRequest): Promise<GetUserResponse> {
		const { api, session } = Container.instance();
		return this._api.getUser(session.apiToken, session.teamId, request.userId);
	}

	handleFetchUsers(request: FetchUsersRequest): Promise<FetchUsersResponse> {
		const { api, session } = Container.instance();
		return this._api.getUsers(session.apiToken, session.teamId);
	}

	handleJoinStream(request: JoinStreamRequest): Promise<JoinStreamResponse> {
		const { api, session } = Container.instance();
		return this._api.joinStream(session.apiToken, session.teamId, request.id);
	}

	handleUpdateStream(request: UpdateStreamRequest): Promise<UpdateStreamResponse> {
		const { api, session } = Container.instance();
		return this._api.updateStream(session.apiToken, request.id, request.data) as any;
	}

	handleUpdateStreamMembership(
		request: UpdateStreamMembershipRequest
	): Promise<UpdateStreamMembershipResponse> {
		const { api, session } = Container.instance();
		return this._api.updateStreamMembership(
			session.apiToken,
			this._teamId!,
			request.streamId,
			request.push
		);
	}

	handleMarkStreamRead(request: MarkStreamReadRequest): Promise<MarkStreamReadResponse> {
		return this._api.markStreamRead(this.apiToken, request.id);
	}
}
