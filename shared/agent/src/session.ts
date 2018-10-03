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
	ApiRequest,
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
	DocumentFromCodeBlockRequest,
	DocumentLatestRevisionRequest,
	DocumentMarkersRequest,
	EditPostRequestType,
	FetchLatestPostRequest,
	FetchLatestPostRequestType,
	FetchLatestPostResponse,
	FetchMarkerLocationsRequest,
	FetchMarkerLocationsRequestType,
	FetchMarkerLocationsResponse,
	FetchPostsInRangeRequest,
	FetchPostsInRangeRequestType,
	FetchPostsInRangeResponse,
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
	InviteRequestType,
	JoinStreamRequest,
	JoinStreamRequestType,
	JoinStreamResponse,
	MarkPostUnreadRequestType,
	MarkStreamReadRequest,
	MarkStreamReadRequestType,
	MarkStreamReadResponse,
	PreparePostWithCodeRequestType,
	ReactToPostRequestType,
	SavePreferencesRequest,
	SavePreferencesRequestType,
	SavePreferencesResponse,
	UpdatePresenceRequestType,
	UpdateStreamMembershipRequestType,
	UpdateStreamRequest,
	UpdateStreamRequestType,
	UpdateStreamResponse
} from "./agent";
import { AgentError, ServerError } from "./agentError";
import {
	ApiErrors,
	CodeStreamApi,
	CreateRepoRequest,
	CreateRepoResponse,
	CSRepository,
	CSStream,
	DeletePostResponse,
	EditPostRequest,
	EditPostResponse,
	FindRepoResponse,
	GetMarkerResponse,
	GetMarkersResponse,
	GetMeResponse,
	GetPostResponse,
	GetRepoResponse,
	GetTeamResponse,
	GetUserResponse,
	GetUsersResponse,
	InviteRequest,
	InviteResponse,
	LoginResult,
	MarkPostUnreadRequest,
	MarkPostUnreadResponse,
	ReactToPostRequest,
	ReactToPostResponse,
	UpdatePresenceRequest,
	UpdatePresenceResponse,
	UpdateStreamMembershipRequest,
	UpdateStreamMembershipResponse
} from "./api/api";
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
import {
	MessageReceivedEvent,
	MessageType,
	PubnubReceiver,
	RepositoriesMessageReceivedEvent
} from "./pubnub/pubnubReceiver";
import {
	CreateChannelStreamRequestType,
	CreateChannelStreamResponse,
	CreateDirectStreamRequestType,
	CreateDirectStreamResponse,
	DidChangeVersionCompatibilityNotification,
	FetchFileStreamsRequest,
	FetchFileStreamsRequestType,
	FetchFileStreamsResponse,
	LogoutReason,
	LogoutRequest
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
	constructor(
		private readonly session: CodeStreamSession,
		private readonly _event: RepositoriesMessageReceivedEvent
	) {}

	entities(): CSRepository[] {
		return this._event.repos;
	}
}

export type SessionChangedEvent = RepositoriesChangedEvent;

export class CodeStreamSession {
	private _onDidChangeRepositories = new Emitter<RepositoriesChangedEvent>();
	get onDidChangeRepositories(): Event<RepositoriesChangedEvent> {
		return this._onDidChangeRepositories.event;
	}

	private readonly _api: CodeStreamApi;
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

		const versionManager = new VersionMiddlewareManager(this._api);
		versionManager.onDidChangeCompatibility(this.onVersionCompatibilityChanged, this);

		this._readyPromise = new Promise<void>(resolve => this.agent.onReady(resolve));
		// this.connection.onHover(e => MarkerHandler.onHover(e));

		this.agent.registerHandler(ApiRequest, (e, cancellationToken: CancellationToken) =>
			this._api.fetch(e.url, e.init, e.token)
		);
		this.agent.registerHandler(DocumentFromCodeBlockRequest, MarkerHandler.documentFromCodeBlock);
		this.agent.registerHandler(DocumentMarkersRequest, MarkerHandler.documentMarkers);
		this.agent.registerHandler(PreparePostWithCodeRequestType, PostHandler.documentPreparePost);
		this.agent.registerHandler(CreatePostWithCodeRequestType, PostHandler.documentPost);
		this.agent.registerHandler(FetchPostsRequestType, PostHandler.getPosts);

		this.agent.registerHandler(DocumentLatestRevisionRequest, async e => {
			const revision = await Container.instance().git.getFileCurrentRevision(
				URI.parse(e.textDocument.uri)
			);
			return { revision: revision };
		});

		this.agent.registerHandler(CreatePostRequestType, this.handleCreatePost);
		this.agent.registerHandler(CreateRepoRequestType, this.handleCreateRepo);
		this.agent.registerHandler(CreateChannelStreamRequestType, this.handleCreateChannelStream);
		this.agent.registerHandler(CreateDirectStreamRequestType, this.handleCreateDirectStream);
		this.agent.registerHandler(DeletePostRequestType, this.handleDeletePost);
		this.agent.registerHandler(ReactToPostRequestType, this.handleReactToPost);
		this.agent.registerHandler(EditPostRequestType, this.handleEditPost);
		this.agent.registerHandler(MarkPostUnreadRequestType, this.handleMarkPostUnread);
		this.agent.registerHandler(FindRepoRequestType, this.handleFindRepo);
		this.agent.registerHandler(GetMarkerRequestType, this.handleGetMarker);
		this.agent.registerHandler(FetchMarkerLocationsRequestType, this.handleFetchMarkerLocations);
		this.agent.registerHandler(GetPostRequestType, this.handleGetPost);
		this.agent.registerHandler(FetchLatestPostRequestType, this.handleFetchLatestPost);
		this.agent.registerHandler(FetchPostsInRangeRequestType, this.handleFetchPostsInRange);
		this.agent.registerHandler(GetRepoRequestType, this.handleGetRepo);
		this.agent.registerHandler(FetchReposRequestType, this.handleFetchRepos);
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
		this.agent.registerHandler(UpdatePresenceRequestType, this.handleUpdatePresence);
		this.agent.registerHandler(
			UpdateStreamMembershipRequestType,
			this.handleUpdateStreamMembership
		);
		this.agent.registerHandler(InviteRequestType, this.handleInvite);
		this.agent.registerHandler(MarkStreamReadRequestType, this.handleMarkStreamRead);
		this.agent.registerHandler(SavePreferencesRequestType, this.handleSavePreferences);
		this.agent.registerHandler(GetMeRequestType, this.handleGetMe);
	}

	private onMessageReceived(e: MessageReceivedEvent) {
		const { postManager } = Container.instance();
		switch (e.type) {
			case MessageType.Posts: {
				postManager.resolve(e.changeSets);
				break;
			}
			case MessageType.Repositories:
				this._onDidChangeRepositories.fire(new RepositoriesChangedEvent(this, e));
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
		this.agent.sendNotification(DidChangeVersionCompatibilityNotification, e);
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
			let loginResponse;
			try {
				if (signupToken) {
					loginResponse = await this._api.checkSignup(signupToken);
				} else {
					loginResponse = await this._api.login(email, passwordOrToken);
				}
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

			this._apiToken = loginResponse.accessToken;
			this._options.passwordOrToken = {
				url: serverUrl,
				email: email,
				value: loginResponse.accessToken
			};

			// If there is only 1 team, use it regardless of config
			if (loginResponse.teams.length === 1) {
				this._options.teamId = loginResponse.teams[0].id;
			} else {
				// Sort the teams from oldest to newest
				loginResponse.teams.sort((a, b) => a.createdAt - b.createdAt);
			}

			if (this._options.teamId == null) {
				if (this._options.team) {
					const normalizedTeamName = this._options.team.toLocaleUpperCase();
					const team = loginResponse.teams.find(
						t => t.name.toLocaleUpperCase() === normalizedTeamName
					);
					if (team != null) {
						this._options.teamId = team.id;
					}
				}

				// If we still can't find a team, then just pick the first one
				if (this._options.teamId == null) {
					this._options.teamId = loginResponse.teams[0].id;
				}
			}

			if (loginResponse.teams.find(t => t.id === this._options.teamId) === undefined) {
				this._options.teamId = loginResponse.teams[0].id;
			}
			this._teamId = this._options.teamId;
			this._userId = loginResponse.user.id;

			setGitPath(this._options.gitPath);
			void (await Container.initialize(this, this._api, this._options, loginResponse));

			this._pubnub = new PubnubReceiver(
				this.agent,
				this._api,
				loginResponse.pubnubKey,
				loginResponse.pubnubToken,
				this._apiToken,
				this._userId,
				this._teamId
			);

			const streams = await this.getSubscribableStreams(this._userId, this._teamId);
			this._pubnub.listen(streams.map(s => s.id));
			this._pubnub.onDidReceiveMessage(this.onMessageReceived, this);
			const { git } = Container.instance();
			git.onRepositoryCommitHashChanged(repo => {
				MarkerLocationManager.flushUncommittedLocations(repo);
			});

			return {
				loginResponse: { ...loginResponse },
				state: { ...Container.instance().state }
			};
		} finally {
			Logger.log(`Login completed in ${Strings.getDurationMilliseconds(start)} ms`);
		}
	}

	logout(reason?: LogoutReason) {
		return this.agent.sendRequest(LogoutRequest, { reason: reason });
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

	handleCreatePost(request: CreatePostRequest): Promise<CreatePostResponse> {
		const { api, session } = Container.instance();
		return api.createPost(session.apiToken, { ...request, teamId: session.teamId });
	}

	handleCreateRepo(request: CreateRepoRequest): Promise<CreateRepoResponse> {
		const { api, session } = Container.instance();
		return api.createRepo(session.apiToken, request);
	}

	handleCreateChannelStream(
		request: CreateChannelStreamRequest
	): Promise<CreateChannelStreamResponse> {
		const { api, session } = Container.instance();
		return api.createStream(session.apiToken, { ...request, teamId: session.teamId }) as any;
	}

	handleCreateDirectStream(
		request: CreateDirectStreamRequest
	): Promise<CreateDirectStreamResponse> {
		const { api, session } = Container.instance();
		return api.createStream(session.apiToken, { ...request, teamId: session.teamId }) as any;
	}

	handleDeletePost(request: DeletePostRequest): Promise<DeletePostResponse> {
		const { api, session } = Container.instance();
		return api.deletePost(session.apiToken, session.teamId, request.id);
	}

	handleReactToPost(request: ReactToPostRequest): Promise<ReactToPostResponse> {
		const { api, session } = Container.instance();
		return api.reactToPost(session.apiToken, request);
	}

	handleEditPost(request: EditPostRequest): Promise<EditPostResponse> {
		const { api, session } = Container.instance();
		return api.editPost(session.apiToken, request);
	}

	handleMarkPostUnread(request: MarkPostUnreadRequest): Promise<MarkPostUnreadResponse> {
		const { api, session } = Container.instance();
		return api.markPostUnread(session.apiToken, request);
	}

	handleFindRepo(request: FindRepoRequest): Promise<FindRepoResponse> {
		const { api } = Container.instance();
		return api.findRepo(request.url, request.firstCommitHashes);
	}

	handleGetMarker(request: GetMarkerRequest): Promise<GetMarkerResponse> {
		const { api, session } = Container.instance();
		return api.getMarker(session.apiToken, request.teamId, request.markerId);
	}

	handleFetchMarkerLocations(
		request: FetchMarkerLocationsRequest
	): Promise<FetchMarkerLocationsResponse> {
		const { api, session } = Container.instance();
		return api.getMarkerLocations(
			session.apiToken,
			session.teamId,
			request.streamId,
			request.commitHash
		);
	}

	handleGetPost(request: GetPostRequest): Promise<GetPostResponse> {
		const { api, session } = Container.instance();
		return api.getPost(session.apiToken, session.teamId, request.id);
	}

	handleFetchLatestPost(request: FetchLatestPostRequest): Promise<FetchLatestPostResponse> {
		const { api, session } = Container.instance();
		return api.getLatestPost(session.apiToken, session.teamId, request.streamId);
	}

	handleFetchPostsInRange(request: FetchPostsInRangeRequest): Promise<FetchPostsInRangeResponse> {
		const { api, session } = Container.instance();
		return api.getPostsInRange(session.apiToken, session.teamId, request.streamId, request.range);
	}

	handleGetRepo(request: GetRepoRequest): Promise<GetRepoResponse> {
		const { api, session } = Container.instance();
		return api.getRepo(session.apiToken, session.teamId, request.repoId);
	}

	handleFetchRepos(request: FetchReposRequest): Promise<FetchReposResponse> {
		const { api, session } = Container.instance();
		return api.getRepos(session.apiToken, session.teamId);
	}

	handleGetStream(request: GetStreamRequest): Promise<GetStreamResponse> {
		const { api, session } = Container.instance();
		return api.getStream(session.apiToken, session.teamId, request.id);
	}

	handleGetUnreadStreams(request: FetchUnreadStreamsRequest): Promise<FetchUnreadStreamsResponse> {
		const { api, session } = Container.instance();
		return api.getUnreadStreams(session.apiToken, session.teamId);
	}

	handleGetStreams(request: FetchStreamsRequest): Promise<FetchStreamsResponse> {
		const { api, session } = Container.instance();
		return api.getStreams(session.apiToken, session.teamId, request.types);
	}

	handleGetFileStreams(request: FetchFileStreamsRequest): Promise<FetchFileStreamsResponse> {
		const { api, session } = Container.instance();
		return api.getStreams(session.apiToken, session.teamId, undefined, request.repoId);
	}

	handleGetTeam(request: GetTeamRequest): Promise<GetTeamResponse> {
		const { api, session } = Container.instance();
		return api.getTeam(session.apiToken, request.teamId);
	}

	handleFetchTeams(request: FetchTeamsRequest): Promise<FetchTeamsResponse> {
		const { api, session } = Container.instance();
		return api.getTeams(session.apiToken, request.teamIds);
	}

	handleGetUser(request: GetUserRequest): Promise<GetUserResponse> {
		const { api, session } = Container.instance();
		return api.getUser(session.apiToken, session.teamId, request.userId);
	}

	handleFetchUsers(request: FetchUsersRequest): Promise<GetUsersResponse> {
		const { api, session } = Container.instance();
		return api.getUsers(session.apiToken, session.teamId);
	}

	handleJoinStream(request: JoinStreamRequest): Promise<JoinStreamResponse> {
		const { api, session } = Container.instance();
		return api.joinStream(session.apiToken, session.teamId, request.id);
	}

	handleUpdateStream(request: UpdateStreamRequest): Promise<UpdateStreamResponse> {
		const { api, session } = Container.instance();
		return api.updateStream(session.apiToken, request.id, request.data) as any;
	}

	handleUpdatePresence(request: UpdatePresenceRequest): Promise<UpdatePresenceResponse> {
		const { api, session } = Container.instance();
		return api.updatePresence(session.apiToken, request);
	}

	handleUpdateStreamMembership(
		request: UpdateStreamMembershipRequest
	): Promise<UpdateStreamMembershipResponse> {
		const { api, session } = Container.instance();
		return api.updateStreamMembership(
			session.apiToken,
			request.teamId,
			request.streamId,
			request.push
		);
	}

	handleInvite(request: InviteRequest): Promise<InviteResponse> {
		const { api, session } = Container.instance();
		return api.invite(session.apiToken, request);
	}

	handleMarkStreamRead(request: MarkStreamReadRequest): Promise<MarkStreamReadResponse> {
		const { api, session } = Container.instance();
		return api.markStreamRead(session.apiToken, request.id);
	}

	handleSavePreferences(request: SavePreferencesRequest): Promise<SavePreferencesResponse> {
		const { api, session } = Container.instance();
		return api.savePreferences(session.apiToken, request.preferences);
	}

	handleGetMe(request: GetMeRequest): Promise<GetMeResponse> {
		const { api, session } = Container.instance();
		return api.getMe(session.apiToken);
	}
}
