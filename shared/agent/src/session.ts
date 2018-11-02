"use strict";
import HttpsProxyAgent from "https-proxy-agent";
import * as url from "url";
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
import { ApiProvider, LoginOptions, MessageType, RTMessage } from "./api/apiProvider";
import { CodeStreamApiProvider } from "./api/codestream/codestreamApi";
import {
	VersionCompatibilityChangedEvent,
	VersionMiddlewareManager
} from "./api/middleware/versionMiddleware";
import { SlackApiProvider } from "./api/slack/slackApi";
import { Container } from "./container";
import { setGitPath } from "./git/git";
import { Logger } from "./logger";
import { MarkerHandler } from "./marker/markerHandler";
import { PostHandler } from "./post/postHandler";
import {
	AgentOptions,
	ApiRequestType,
	ChangeDataType,
	CodeStreamEnvironment,
	CreatePostWithCodeRequestType,
	DidChangeDataNotificationType,
	DidChangeVersionCompatibilityNotificationType,
	DidLogoutNotificationType,
	DidResetNotificationType,
	DocumentFromCodeBlockRequestType,
	DocumentLatestRevisionRequestType,
	DocumentMarkersRequestType,
	FetchMarkerLocationsRequestType,
	LogoutReason,
	PreparePostWithCodeRequestType,
	ResetReason
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
import { memoize } from "./system/decorators";

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

export interface VersionInfo {
	extension: {
		build: string;
		buildEnv: string;
		version: string;
		versionFormatted: string;
	};

	ide: {
		name: string;
		version: string;
	};
}

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

	private _onDidRequestReset = new Emitter<void>();
	get onDidRequestReset(): Event<void> {
		return this._onDidRequestReset.event;
	}

	private readonly _proxyAgent: HttpsProxyAgent | undefined;
	private readonly _readyPromise: Promise<void>;

	constructor(
		public readonly agent: CodeStreamAgent,
		public readonly connection: Connection,
		private readonly _options: AgentOptions
	) {
		this._readyPromise = new Promise<void>(resolve =>
			this.agent.onReady(() => {
				Logger.log("Agent is ready");
				resolve();
			})
		);

		this._environment = this.getEnvironment(this._options.serverUrl);

		Container.initialize(this);

		if (_options.proxy != null) {
			this._proxyAgent = new HttpsProxyAgent({
				...url.parse(_options.proxy.url),
				rejectUnauthorized: _options.proxy.strictSSL
			});
		}

		this._api = new CodeStreamApiProvider(_options.serverUrl, this.versionInfo, this._proxyAgent);

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
			case MessageType.MarkerLocations:
				const markerLocations = await Container.instance().markerLocations.resolve(e);
				this._onDidChangeMarkerLocations.fire(markerLocations);
				this.agent.sendNotification(DidChangeDataNotificationType, {
					type: ChangeDataType.MarkerLocations,
					data: markerLocations
				});
				break;
			case MessageType.Markers:
				const markers = await Container.instance().markers.resolve(e);
				this._onDidChangeMarkers.fire(markers);
				this.agent.sendNotification(DidChangeDataNotificationType, {
					type: ChangeDataType.Markers,
					data: markers
				});
				break;
			case MessageType.Posts:
				this._onDidChangePosts.fire(e.data);
				this.agent.sendNotification(DidChangeDataNotificationType, {
					type: ChangeDataType.Posts,
					data: e.data
				});
				break;
			case MessageType.Preferences:
				this.agent.sendNotification(DidChangeDataNotificationType, {
					type: ChangeDataType.Preferences,
					data: e.data
				});
				break;
			case MessageType.Repositories:
				this._onDidChangeRepositories.fire(e.data);
				this.agent.sendNotification(DidChangeDataNotificationType, {
					type: ChangeDataType.Repositories,
					data: e.data
				});
				break;
			case MessageType.Streams:
				this._onDidChangeStreams.fire(e.data);
				this.agent.sendNotification(DidChangeDataNotificationType, {
					type: ChangeDataType.Streams,
					data: e.data
				});
				break;
			case MessageType.Teams:
				this._onDidChangeTeams.fire(e.data);
				this.agent.sendNotification(DidChangeDataNotificationType, {
					type: ChangeDataType.Teams,
					data: e.data
				});
				break;
			case MessageType.Unreads:
				this.agent.sendNotification(DidChangeDataNotificationType, {
					type: ChangeDataType.Unreads,
					data: e.data
				});
				break;
			case MessageType.Users:
				this._onDidChangeUsers.fire(e.data);
				this.agent.sendNotification(DidChangeDataNotificationType, {
					type: ChangeDataType.Users,
					data: e.data
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

	private _environment: CodeStreamEnvironment | undefined;
	get environment() {
		return this._environment!;
	}

	private _teamId: string | undefined;
	get teamId() {
		return this._teamId!;
	}

	private _userId: string | undefined;
	get userId() {
		return this._userId!;
	}

	private _userEmail: string | undefined;
	get userEmail() {
		return this._userEmail!;
	}

	@memoize
	get versionInfo(): Readonly<VersionInfo> {
		return {
			extension: { ...this._options.extension },
			ide: { ...this._options.ide }
		};
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

			const currentTeam = response.teams.find(t => t.id === this._teamId)!;
			let isCurrentTeamSlack = false;

			if (response.user.providerInfo && response.user.providerInfo.slack) {
				if (currentTeam.providerInfo && currentTeam.providerInfo.slack) {
					isCurrentTeamSlack = true;
					Logger.log(
						`Logging into Slack because team '${currentTeam.name}' (${
							currentTeam.id
						}) is a Slack-based team`
					);

					this._api = new SlackApiProvider(
						this._api! as CodeStreamApiProvider,
						response.user.providerInfo.slack,
						response.user,
						this._teamId,
						this._proxyAgent
					);

					await (this._api as SlackApiProvider).processLoginResponse(response);

					Logger.log(
						`Logged into Slack as '${response.user.username}' (${response.user.id}), Slack team ${
							currentTeam.providerInfo.slack.teamId
						}`
					);
				}
			}

			// Make sure to update this after the slack switch as the userId will change
			this._userId = response.user.id;
			this._userEmail = response.user.email;

			setGitPath(this._options.gitPath);

			this.api.onDidReceiveMessage(e => this.onRTMessageReceived(e), this);

			Logger.log(`Subscribing to realtime events...`);
			this.api.subscribe();

			Container.instance().git.onRepositoryCommitHashChanged(repo => {
				Container.instance().markerLocations.flushUncommittedLocations(repo);
			});

			// Initialize Mixpanel tracking
			// TODO: Check for opt in
			const user = response.user;
			const analytics = Container.instance().analytics;
			const props: { [key: string]: any } = {
				"Email Address": user.email,
				"Team ID": this._teamId,
				"Plugin Version": this._options.extension.versionFormatted,
				Plan: "Free", // will have more options in future
				Endpoint: "VS Code",
				Provider: isCurrentTeamSlack ? "Slack" : "CodeStream"
			};

			if (currentTeam != null) {
				props["Team Name"] = currentTeam.name;
				if (currentTeam.memberIds != null) {
					props["Team Size"] = currentTeam.memberIds.length;
				}
			}

			try {
				props["Date Signed Up"] = new Date(user.registeredAt).toISOString();
			} catch (ex) {
				Logger.error(ex);
			}

			try {
				props["Date of Last Post"] = new Date(user.lastPostCreatedAt).toISOString();
			} catch (ex) {
				Logger.error(ex);
			}

			analytics.setDistinctId(response.user.id);
			analytics.setSuperProps(props);

			return {
				loginResponse: { ...response },
				state: {
					apiToken: response.accessToken,
					capabilities: this.api.capabilities,
					email: email,
					environment: this._environment,
					serverUrl: serverUrl,
					teamId: this._teamId,
					userId: this._userId
				}
			};
		} finally {
			Logger.log(`Login completed in ${Strings.getDurationMilliseconds(start)} ms`);
		}
	}

	logout(reason: LogoutReason) {
		return this.agent.sendNotification(DidLogoutNotificationType, { reason: reason });
	}

	async ready() {
		return this._readyPromise;
	}

	async reset(reason: ResetReason) {
		this._onDidRequestReset.fire(undefined);
		this.agent.sendNotification(DidResetNotificationType, { reason: reason });
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
