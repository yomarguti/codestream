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
	DocumentFromCodeBlockRequest,
	DocumentLatestRevisionRequest,
	DocumentMarkersRequest,
	DocumentPostRequest,
	DocumentPreparePostRequest,
	GetPostsRequest
} from "./agent";
import { AgentError, ServerError } from "./agentError";
import { ApiErrors, CodeStreamApi, CSRepository, CSStream, LoginResult } from "./api/api";
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
	DidChangeVersionCompatibilityNotification,
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
		this.agent.registerHandler(DocumentPreparePostRequest, PostHandler.documentPreparePost);
		this.agent.registerHandler(DocumentPostRequest, PostHandler.documentPost);
		this.agent.registerHandler(GetPostsRequest, PostHandler.getPosts);

		this.agent.registerHandler(DocumentLatestRevisionRequest, async e => {
			const revision = await Container.instance().git.getFileCurrentRevision(
				URI.parse(e.textDocument.uri)
			);
			return { revision: revision };
		});
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
}
