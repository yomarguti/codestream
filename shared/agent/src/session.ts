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
import { ApiProvider, LoginOptions, RTMessage } from "./api/apiProvider";
import { CodeStreamApiProvider } from "./api/codestreamApi";
import {
	VersionCompatibilityChangedEvent,
	VersionMiddlewareManager
} from "./api/middleware/versionMiddleware";
import { SlackApiProvider } from "./api/slackApi";
import { Container } from "./container";
import { setGitPath } from "./git/git";
import { Logger } from "./logger";
import { MarkerHandler } from "./marker/markerHandler";
import { PostHandler } from "./post/postHandler";
import {
	AgentOptions,
	ApiRequestType,
	CodeStreamEnvironment,
	CreatePostWithCodeRequestType,
	DidChangeDataNotificationType,
	DidChangeVersionCompatibilityNotificationType,
	DocumentFromCodeBlockRequestType,
	DocumentLatestRevisionRequestType,
	DocumentMarkersRequestType,
	FetchMarkerLocationsRequestType,
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
	LoginResult
} from "./shared/api.protocol";
import { Strings } from "./system";

const envRegex = /https?:\/\/(pd-|qa-)?api.codestream.(?:us|com)/;

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
	private _onDidChangeMarkerLocations = new Emitter<CSMarkerLocations[]>();
	get onDidChangeMarkerLocations(): Event<CSMarkerLocations[]> {
		return this._onDidChangeMarkerLocations.event;
	}

	private _onDidChangeMarkers = new Emitter<CSMarker[]>();
	get onDidChangeMarkers(): Event<CSMarker[]> {
		return this._onDidChangeMarkers.event;
	}

	private _onDidChangePosts = new Emitter<CSPost[]>();
	get onDidChangePosts(): Event<CSPost[]> {
		return this._onDidChangePosts.event;
	}

	private _onDidChangeRepositories = new Emitter<CSRepository[]>();
	get onDidChangeRepositories(): Event<CSRepository[]> {
		return this._onDidChangeRepositories.event;
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

	private readonly _readyPromise: Promise<void>;

	constructor(
		public readonly agent: CodeStreamAgent,
		public readonly connection: Connection,
		private readonly _options: AgentOptions
	) {
		Logger.log("Agent initalizing...");

		this._readyPromise = new Promise<void>(resolve =>
			this.agent.onReady(() => {
				Logger.log("Agent is ready");
				resolve();
			})
		);
		Container.initialize(this);

		this._api = new CodeStreamApiProvider(_options.serverUrl, {
			ideVersion: _options.ideVersion,
			extensionVersion: _options.extensionVersion,
			extensionBuild: _options.extensionBuild
		});

		const versionManager = new VersionMiddlewareManager(this._api);
		versionManager.onDidChangeCompatibility(this.onVersionCompatibilityChanged, this);

		// this.connection.onHover(e => MarkerHandler.onHover(e));

		this.agent.registerHandler(ApiRequestType, (e, cancellationToken: CancellationToken) =>
			this.api.fetch(e.url, e.init, e.token)
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

		this.agent.registerHandler(FetchMarkerLocationsRequestType, r =>
			this.api.fetchMarkerLocations(r)
		);
	}

	private async onRTMessageReceived(e: RTMessage) {
		switch (e.type) {
			case MessageType.Posts:
				const posts = await Container.instance().posts.resolve(e);
				this._onDidChangePosts.fire(posts);
				this.agent.sendNotification(DidChangeDataNotificationType, {
					type: MessageType.Posts,
					posts
				});
				break;
			case MessageType.Repositories:
				const repos = await Container.instance().repos.resolve(e);
				this._onDidChangeRepositories.fire(repos);
				this.agent.sendNotification(DidChangeDataNotificationType, {
					type: MessageType.Repositories,
					repos
				});
				break;
			case MessageType.Streams:
				const streams = await Container.instance().streams.resolve(e);
				this._onDidChangeStreams.fire(streams);
				this.agent.sendNotification(DidChangeDataNotificationType, {
					type: MessageType.Streams,
					streams
				});
				break;
			case MessageType.Users:
				const users = await Container.instance().users.resolve(e);
				this._onDidChangeUsers.fire(users);
				this.agent.sendNotification(DidChangeDataNotificationType, {
					type: MessageType.Users,
					users
				});
				break;
			case MessageType.Teams:
				const teams = await Container.instance().teams.resolve(e);
				this._onDidChangeTeams.fire(teams);
				this.agent.sendNotification(DidChangeDataNotificationType, {
					type: MessageType.Teams,
					teams
				});
				break;
			case MessageType.Markers:
				const markers = await Container.instance().markers.resolve(e);
				this._onDidChangeMarkers.fire(markers);
				this.agent.sendNotification(DidChangeDataNotificationType, {
					type: MessageType.Markers,
					markers
				});
				break;
			case MessageType.MarkerLocations:
				const markerLocations = await Container.instance().markerLocations.resolve(e);
				this._onDidChangeMarkerLocations.fire(markerLocations);
				this.agent.sendNotification(DidChangeDataNotificationType, {
					type: MessageType.MarkerLocations,
					markerLocations
				});
				break;
		}
	}

	private onVersionCompatibilityChanged(e: VersionCompatibilityChangedEvent) {
		this.agent.sendNotification(DidChangeVersionCompatibilityNotificationType, e);
	}

	private _api: ApiProvider | undefined;
	get api() {
		return this._api!;
	}

	private _codestreamUserId: string | undefined;
	get codestreamUserId() {
		return this._codestreamUserId!;
	}

	private _teamId: string | undefined;
	get teamId() {
		return this._teamId!;
	}

	private _userId: string | undefined;
	get userId() {
		return this._userId!;
	}

	get workspace() {
		return this.connection.workspace;
	}

	async login() {
		const { email, passwordOrToken, serverUrl, signupToken, team, teamId } = this._options;
		if (!signupToken && typeof passwordOrToken !== "string") {
			if (passwordOrToken.email !== email || passwordOrToken.url !== serverUrl) {
				throw new AgentError("Invalid credentials.");
			}
		}

		const start = process.hrtime();

		try {
			let opts = { team: team, teamId: teamId } as LoginOptions;
			if (signupToken) {
				Logger.log(`Logging ${email} into CodeStream via credentials...`);

				opts = { ...opts, type: "otc", code: signupToken };
			} else if (typeof passwordOrToken === "string") {
				Logger.log(`Logging ${email} into CodeStream via CodeStream code...`);

				opts = {
					...opts,
					type: "credentials",
					email: email,
					password: passwordOrToken
				};
			} else {
				Logger.log(`Logging ${email} into CodeStream via authentication token...`);

				opts = {
					...opts,
					type: "token",
					token: passwordOrToken
				};
			}

			let response;
			try {
				response = await this.api.login(opts);
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

			this._options.passwordOrToken = {
				url: serverUrl,
				email: email,
				value: response.accessToken
			};

			this._teamId = this._options.teamId = response.teamId;
			this._codestreamUserId = response.user.id;

			if (response.user.providerInfo && response.user.providerInfo.slack) {
				const currentTeam = response.teams.find(t => t.id === this._teamId)!;

				if (currentTeam.providerInfo && currentTeam.providerInfo.slack) {
					Logger.log(
						`Logging into Slack because team '${currentTeam.name}' (${
							currentTeam.id
						}) is a Slack-based team`
					);

					this._api = new SlackApiProvider(
						this._api! as CodeStreamApiProvider,
						response.user.providerInfo.slack,
						response.user,
						this._teamId
					);

					await (this._api as SlackApiProvider).processLoginResponse(response);

					Logger.log(`Logged into Slack as '${response.user.username}' (${response.user.id})`);
				}
			}

			// Make sure to update this after the slack switch as the userId will change
			this._userId = response.user.id;

			setGitPath(this._options.gitPath);

			this.api.onDidReceiveMessage(e => this.onRTMessageReceived(e), this);

			Logger.log(`Subscribing to realtime events...`);
			this.api.subscribe();

			Container.instance().git.onRepositoryCommitHashChanged(repo => {
				Container.instance().markerLocations.flushUncommittedLocations(repo);
			});

			return {
				loginResponse: { ...response },
				state: {
					apiToken: response.accessToken,
					email: email,
					environment: this.getEnvironment(serverUrl),
					serverUrl: serverUrl,
					teamId: this._teamId,
					userId: this._userId
				}
			};
		} finally {
			Logger.log(`Login completed in ${Strings.getDurationMilliseconds(start)} ms`);
		}
	}

	logout(reason?: LogoutReason) {
		return this.agent.sendRequest(LogoutRequestType, { reason: reason });
	}

	async ready() {
		return this._readyPromise;
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

	private getEnvironment(url: string) {
		const match = envRegex.exec(url);
		if (match == null) return CodeStreamEnvironment.Unknown;

		const [, env] = match;
		switch (env == null ? env : env.toLowerCase()) {
			case "pd-":
				return CodeStreamEnvironment.PD;
			case "qa-":
				return CodeStreamEnvironment.QA;
			default:
				return CodeStreamEnvironment.Production;
		}
	}
}
