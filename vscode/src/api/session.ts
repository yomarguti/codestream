"use strict";
import { ConfigurationTarget, Disposable, Event, EventEmitter } from "vscode";
import {
	AccessToken,
	AgentResult,
	ChangeDataType,
	CodeStreamEnvironment,
	CSUnreads,
	DidChangeDataNotification,
	DocumentMarkersChangedEvent,
	LoginResult
} from "../agent/agentConnection";
import { WorkspaceState } from "../common";
import { configuration } from "../configuration";
import { Container } from "../container";
import { Logger } from "../logger";
import { Functions, Strings } from "../system";
import { Marker } from "./models/markers";
import { Post } from "./models/posts";
import { Repository } from "./models/repositories";
import {
	ChannelStream,
	ChannelStreamCreationOptions,
	DirectStream,
	FileStream,
	Stream,
	StreamThread,
	StreamType
} from "./models/streams";
import { Team } from "./models/teams";
import { User } from "./models/users";
import {
	MergeableEvent,
	PostsChangedEvent,
	PreferencesChangedEvent,
	RepositoriesChangedEvent,
	SessionChangedEvent,
	SessionChangedEventType,
	SessionStatusChangedEvent,
	StreamsChangedEvent,
	StreamsMembershipChangedEvent,
	TeamsChangedEvent,
	TextDocumentMarkersChangedEvent,
	UnreadsChangedEvent,
	UsersChangedEvent
} from "./sessionEvents";
import { SessionState } from "./sessionState";
import { TokenManager } from "./tokenManager";

export {
	ChannelStream,
	ChannelStreamCreationOptions,
	CodeStreamEnvironment,
	DirectStream,
	FileStream,
	Marker,
	DocumentMarkersChangedEvent,
	Post,
	PostsChangedEvent,
	PreferencesChangedEvent,
	Repository,
	RepositoriesChangedEvent,
	SessionChangedEventType,
	SessionStatusChangedEvent,
	Stream,
	StreamsChangedEvent,
	StreamsMembershipChangedEvent,
	StreamThread,
	StreamType,
	Team,
	TeamsChangedEvent,
	TextDocumentMarkersChangedEvent,
	UnreadsChangedEvent,
	User,
	UsersChangedEvent
};

const envRegex = /https?:\/\/(pd-|qa-)?api.codestream.(?:us|com)/;
const instanceId = Functions.shortUuid();

export enum SessionSignedOutReason {
	NetworkIssue = "networkIssue",
	SignInFailure = "signInFailure",
	UserSignedOut = "userSignedOut",
	UserWentOffline = "userWentOffline"
}

export enum SessionStatus {
	SignedOut = "signedOut",
	SigningIn = "signingIn",
	SignedIn = "signedIn"
}

export class CodeStreamSession implements Disposable {
	private _onDidChangeTextDocumentMarkers = new EventEmitter<TextDocumentMarkersChangedEvent>();
	get onDidChangeTextDocumentMarkers(): Event<TextDocumentMarkersChangedEvent> {
		return this._onDidChangeTextDocumentMarkers.event;
	}

	private _onDidChangePosts = new EventEmitter<PostsChangedEvent>();
	get onDidChangePosts(): Event<PostsChangedEvent> {
		return this._onDidChangePosts.event;
	}
	private fireDidChangePosts = createMergableDebouncedEvent(this._onDidChangePosts);

	private _onDidChangePreferences = new EventEmitter<PreferencesChangedEvent>();
	get onDidChangePreferences(): Event<PreferencesChangedEvent> {
		return this._onDidChangePreferences.event;
	}
	private fireDidChangePreferences = createMergableDebouncedEvent(this._onDidChangePreferences);

	private _onDidChangeRepositories = new EventEmitter<RepositoriesChangedEvent>();
	get onDidChangeRepositories(): Event<RepositoriesChangedEvent> {
		return this._onDidChangeRepositories.event;
	}
	private fireDidChangeRepositories = createMergableDebouncedEvent(this._onDidChangeRepositories);

	private _onDidChangeSessionStatus = new EventEmitter<SessionStatusChangedEvent>();
	get onDidChangeSessionStatus(): Event<SessionStatusChangedEvent> {
		return this._onDidChangeSessionStatus.event;
	}

	private _onDidChangeStreams = new EventEmitter<
		StreamsChangedEvent | StreamsMembershipChangedEvent
	>();
	get onDidChangeStreams(): Event<StreamsChangedEvent | StreamsMembershipChangedEvent> {
		return this._onDidChangeStreams.event;
	}
	private fireDidChangeStreams = createMergableDebouncedEvent(this._onDidChangeStreams);

	private _onDidChangeTeams = new EventEmitter<TeamsChangedEvent>();
	get onDidChangeTeams(): Event<TeamsChangedEvent> {
		return this._onDidChangeTeams.event;
	}
	private fireDidChangeTeams = createMergableDebouncedEvent(this._onDidChangeTeams);

	private _onDidChangeUnreads = new EventEmitter<UnreadsChangedEvent>();
	get onDidChangeUnreads(): Event<UnreadsChangedEvent> {
		return this._onDidChangeUnreads.event;
	}
	private fireDidChangeUnreads = Functions.debounce(
		(e: UnreadsChangedEvent) => this._onDidChangeUnreads.fire(e),
		250,
		{ maxWait: 1000 }
	);

	private _onDidChangeUsers = new EventEmitter<UsersChangedEvent>();
	get onDidChangeUsers(): Event<UsersChangedEvent> {
		return this._onDidChangeUsers.event;
	}
	private fireDidChangeUsers = createMergableDebouncedEvent(this._onDidChangeUsers);

	private _disposable: Disposable | undefined;

	private _email: string | undefined;
	private _environment = CodeStreamEnvironment.Unknown;
	private _id: string | undefined;
	private _loginPromise: Promise<LoginResult> | undefined;
	private _state: SessionState | undefined;
	private _signupToken: string | undefined;

	constructor(private _serverUrl: string) {
		this.setServerUrl(_serverUrl);
	}

	dispose() {
		this._disposable && this._disposable.dispose();
	}

	private onDocumentMarkersChanged(e: DocumentMarkersChangedEvent) {
		this._onDidChangeTextDocumentMarkers.fire(new TextDocumentMarkersChangedEvent(this, e.uri));
	}

	private onDataChanged(e: DidChangeDataNotification) {
		switch (e.type) {
			case ChangeDataType.Posts:
				this.fireDidChangePosts(new PostsChangedEvent(this, e));
				break;
			case ChangeDataType.Preferences:
				this.fireDidChangePreferences(new PreferencesChangedEvent(this, e));
				break;
			case ChangeDataType.Repositories:
				this.fireDidChangeRepositories(new RepositoriesChangedEvent(this, e));
				break;
			case ChangeDataType.Streams:
				this.fireDidChangeStreams(new StreamsChangedEvent(this, e));
				break;
			case ChangeDataType.Teams:
				this._state!.updateTeams();

				this.fireDidChangeTeams(new TeamsChangedEvent(this, e));
				break;
			case ChangeDataType.Unreads:
				this.fireDidChangeUnreads(new UnreadsChangedEvent(this, e));
				break;
			case ChangeDataType.Users:
				this.fireDidChangeUsers(new UsersChangedEvent(this, e));
				break;
		}
	}

	get email() {
		return this._email;
	}

	get id() {
		return this._id;
	}

	@signedIn
	get channels() {
		return this._state!.channels;
	}

	@signedIn
	get channelsAndDMs() {
		return this._state!.channelsAndDMs;
	}

	@signedIn
	get directMessages() {
		return this._state!.directMessages;
	}

	get environment(): CodeStreamEnvironment {
		return this._environment;
	}

	get serverUrl(): string {
		return this._serverUrl;
	}
	private setServerUrl(url: string) {
		this._serverUrl = url;
		this._environment = CodeStreamEnvironment.Unknown;

		const match = envRegex.exec(url);
		if (match == null) return;

		const [, env] = match;
		switch (env == null ? env : env.toLowerCase()) {
			case "pd-":
				this._environment = CodeStreamEnvironment.PD;
				break;
			case "qa-":
				this._environment = CodeStreamEnvironment.QA;
				break;
			default:
				this._environment = CodeStreamEnvironment.Production;
				break;
		}
	}

	get signedIn() {
		return this._status === SessionStatus.SignedIn;
	}

	private _status: SessionStatus = SessionStatus.SignedOut;
	get status() {
		return this._status;
	}
	private setStatus(
		status: SessionStatus,
		signedOutReason?: SessionSignedOutReason,
		unreads?: CSUnreads
	) {
		this._status = status;
		const e: SessionStatusChangedEvent = {
			getStatus: () => this._status,
			session: this,
			unreads: unreads
		};
		e.reason = signedOutReason;

		this._onDidChangeSessionStatus.fire(e);
	}

	@signedIn
	get team() {
		return this._state!.team;
	}

	@signedIn
	get user() {
		return this._state!.user;
	}

	get userId() {
		return this._state!.userId;
	}

	@signedIn
	get users() {
		return this._state!.users;
	}

	getSignupToken() {
		if (!this._signupToken) this._signupToken = Functions.uuid();

		return this._signupToken;
	}

	@signedIn
	async getStream(streamId: string): Promise<Stream | undefined> {
		const stream = (await Container.agent.streams.get(streamId)).stream;
		if (stream === undefined) return undefined;

		switch (stream.type) {
			case StreamType.Channel:
				return new ChannelStream(this, stream);
			case StreamType.Direct:
				return new DirectStream(this, stream);
			default:
				throw new Error("Invalid stream type");
		}
	}

	async goOffline() {
		Container.webview.hide();
		return Container.session.logout(SessionSignedOutReason.UserWentOffline);
	}

	@signedIn
	hasSingleTeam(): boolean {
		return this._state!.hasSingleTeam();
	}

	async login(email: string, password: string, teamId?: string): Promise<LoginResult>;
	async login(email: string, token: AccessToken, teamId?: string): Promise<LoginResult>;
	async login(
		email: string,
		passwordOrToken: string | AccessToken,
		teamId?: string
	): Promise<LoginResult> {
		if (this._loginPromise === undefined) {
			this._loginPromise = this.loginCore(email, passwordOrToken, teamId);
		}

		const result = await this._loginPromise;
		if (result !== LoginResult.Success) {
			this._loginPromise = undefined;
		}
		return result;
	}

	async loginViaSignupToken(token?: string): Promise<LoginResult> {
		// TODO: reuse this._loginPromise
		if (this._signupToken === undefined && token === undefined) {
			throw new Error("A signup token hasn't been generated");
		}

		this.setServerUrl(Container.config.serverUrl);
		this.setStatus(SessionStatus.SigningIn);

		const result = await Container.agent.loginViaSignupToken(
			this._serverUrl,
			this._signupToken || token!
		);

		if (result.error) {
			this.setStatus(SessionStatus.SignedOut, SessionSignedOutReason.SignInFailure);

			if (result.error !== LoginResult.NotOnTeam && result.error !== LoginResult.NotConfirmed) {
				this._signupToken = undefined;
			}

			return result.error;
		}

		await this.completeLogin(result, this._signupToken);
		return LoginResult.Success;
	}

	async logout(reason: SessionSignedOutReason = SessionSignedOutReason.UserSignedOut) {
		this._id = undefined;
		this._loginPromise = undefined;

		try {
			if (reason === SessionSignedOutReason.UserSignedOut) {
				// Clear the access token
				await Container.context.workspaceState.update(WorkspaceState.TeamId, undefined);
				await TokenManager.clear(this._serverUrl, this._email!);
			}

			this._email = undefined;
			this._status = SessionStatus.SignedOut;

			if (Container.agent !== undefined) {
				void (await Container.agent.logout());
			}

			if (this._disposable !== undefined) {
				this._disposable.dispose();
				this._disposable = undefined;
			}
		} finally {
			// Clean up saved state
			this._state = undefined;
			this._signupToken = undefined;

			setImmediate(() =>
				this._onDidChangeSessionStatus.fire({
					getStatus: () => this._status,
					session: this,
					reason: reason
				})
			);
		}
	}

	@signedIn
	// HACK: Hate exposing this here -- should ideally be wrapped up all the way in the agent
	notifyDidLeaveChannel(id: string, teamId?: string) {
		this.fireDidChangeStreams(
			new StreamsMembershipChangedEvent(this, [{ id: id, teamId: teamId || this._state!.teamId }])
		);
	}

	private async loginCore(
		email: string,
		passwordOrToken: string | AccessToken,
		teamId?: string
	): Promise<LoginResult> {
		this.setServerUrl(Container.config.serverUrl);
		Logger.log(`Signing ${email} into CodeStream (${this.serverUrl})`);

		try {
			this.setStatus(SessionStatus.SigningIn);

			if (!teamId) {
				// If there is a configuration settings for a team, use that above others
				teamId = Container.config.team
					? undefined
					: Container.context.workspaceState.get(WorkspaceState.TeamId);
			}

			const result = await Container.agent.login(
				this._serverUrl,
				email,
				passwordOrToken,
				teamId,
				Container.config.team
			);

			if (result.error) {
				// Clear the access token
				await TokenManager.clear(this._serverUrl, email);
				this.setStatus(SessionStatus.SignedOut, SessionSignedOutReason.SignInFailure);

				return result.error;
			}

			await this.completeLogin(result, teamId);

			return LoginResult.Success;
		} catch (ex) {
			ex.message = ex.message.replace("Request initialize failed with message: ", "CodeStream: ");

			Logger.error(ex);
			void (await this.logout(SessionSignedOutReason.SignInFailure));

			throw ex;
		}
	}

	private async completeLogin(result: AgentResult, teamId?: string) {
		const user = result.loginResponse.user;
		const email = user.email;
		this._email = email;
		this._environment = result.state.environment;

		// Create an id for this session
		this._id = Strings.sha1(`${instanceId}|${this.serverUrl}|${email}|${teamId}`.toLowerCase());

		const token = result.loginResponse.accessToken;
		await TokenManager.addOrUpdate(this._serverUrl, email, token);

		// Update the saved e-mail on successful login
		if (email !== Container.config.email) {
			let target = ConfigurationTarget.Global;

			// Determine where to best save the e-mail
			const emailSetting = configuration.inspect(configuration.name("email").value);
			// If we have an e-mail in the workspace, save it to the workspace
			if (emailSetting !== undefined && emailSetting.workspaceValue !== undefined) {
				target = ConfigurationTarget.Workspace;
			} else {
				// If we don't have an e-mail in the workspace, check if the serverUrl is in the workspace
				const serverUrlSetting = configuration.inspect(configuration.name("serverUrl").value);
				// If we have a serverUrl in the workspace, save the e-mail to the workspace
				if (serverUrlSetting !== undefined && serverUrlSetting.workspaceValue !== undefined) {
					target = ConfigurationTarget.Workspace;
				}
			}

			await configuration.update(configuration.name("email").value, email, target);
		}

		if (!teamId || teamId !== result.state.teamId) {
			teamId = result.state.teamId;
			await Container.context.workspaceState.update(WorkspaceState.TeamId, teamId);
		}

		this._state = new SessionState(this, teamId, result.loginResponse);

		this._disposable = Disposable.from(
			Container.agent.onDidChangeDocumentMarkers(
				Functions.debounce(this.onDocumentMarkersChanged, 500),
				this
			),
			Container.agent.onDidChangeData(this.onDataChanged, this)
		);

		const unreadsResponse = await Container.agent.users.unreads();
		const unreads = unreadsResponse.unreads;

		Logger.log(
			`${email} signed into CodeStream (${this.serverUrl}); userId=${this.userId}, teamId=${teamId}`
		);

		this.setStatus(SessionStatus.SignedIn, undefined, unreads);
	}
}

function createMergableDebouncedEvent<E extends MergeableEvent<SessionChangedEvent>>(emitter: {
	fire(e?: E): void;
}) {
	return Functions.debounceMerge(
		(e: E) => emitter.fire(e),
		(combined: E[] | undefined, current: E) => {
			if (combined === undefined) return [current];

			combined[0].merge(current);
			return combined;
		},
		250,
		{ maxWait: 1000 }
	);
}

function signedIn(
	target: CodeStreamSession,
	propertyName: string,
	descriptor: TypedPropertyDescriptor<any>
) {
	if (typeof descriptor.value === "function") {
		const method = descriptor.value;
		descriptor.value = function(this: CodeStreamSession, ...args: any[]) {
			if (!this.signedIn) throw new Error("Not Logged In");
			return method!.apply(this, args);
		};
	} else if (typeof descriptor.get === "function") {
		const get = descriptor.get;
		descriptor.get = function(this: CodeStreamSession, ...args: any[]) {
			if (!this.signedIn) throw new Error("Not Logged In");
			return get!.apply(this, args);
		};
	}
}
