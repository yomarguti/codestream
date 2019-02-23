"use strict";
import {
	AccessToken,
	AgentResult,
	Capabilities,
	ChangeDataType,
	CodeStreamEnvironment,
	DidChangeDataNotification,
	DidChangeDocumentMarkersNotification,
	Unreads
} from "@codestream/protocols/agent";
import {
	ChannelServiceType,
	CSChannelStream,
	CSDirectStream,
	LoginResult
} from "@codestream/protocols/api";
import {
	commands,
	ConfigurationTarget,
	Disposable,
	Event,
	EventEmitter,
	MessageItem,
	Uri,
	window
} from "vscode";
import { WorkspaceState } from "../common";
import { configuration } from "../configuration";
import { extensionQualifiedId } from "../constants";
import { Container } from "../container";
import { Logger } from "../logger";
import { Functions, log, Strings } from "../system";
import { Marker } from "./models/marker";
import { Post } from "./models/post";
import { Repository } from "./models/repository";
import {
	ChannelStream,
	ChannelStreamCreationOptions,
	DirectStream,
	ServiceChannelStreamCreationOptions,
	Stream,
	StreamThread,
	StreamType
} from "./models/stream";
import { Team } from "./models/team";
import { User } from "./models/user";
import {
	CodemarksChangedEvent,
	MergeableEvent,
	PostsChangedEvent,
	PreferencesChangedEvent,
	RepositoriesChangedEvent,
	SessionChangedEvent,
	SessionChangedEventType,
	SessionStatusChangedEvent,
	StreamsChangedEvent,
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
	CodemarksChangedEvent,
	CodeStreamEnvironment,
	DirectStream,
	Marker,
	Post,
	PostsChangedEvent,
	PreferencesChangedEvent,
	Repository,
	RepositoriesChangedEvent,
	SessionChangedEventType,
	SessionStatusChangedEvent,
	Stream,
	StreamsChangedEvent,
	StreamThread,
	StreamType,
	Team,
	TeamsChangedEvent,
	TextDocumentMarkersChangedEvent,
	UnreadsChangedEvent,
	User,
	UsersChangedEvent
};

// FIXME: Must keep this in sync with codestream-lsp-agent/src/session.ts
const envRegex = /https?:\/\/((?:(\w+)-)?api|localhost)\.codestream\.(?:us|com)(?::\d+$)?/i;
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

	private _onDidChangeCodemarks = new EventEmitter<CodemarksChangedEvent>();
	get onDidChangeCodemarks(): Event<CodemarksChangedEvent> {
		return this._onDidChangeCodemarks.event;
	}
	private fireDidChangeCodemarks = createMergableDebouncedEvent(this._onDidChangeCodemarks);

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

	private _onDidChangeStreams = new EventEmitter<StreamsChangedEvent>();
	get onDidChangeStreams(): Event<StreamsChangedEvent> {
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

	private _agentCapabilities: Capabilities | undefined;
	private _capabilities: Capabilities | undefined;
	get capabilities() {
		if (this._capabilities === undefined) {
			const ide: Capabilities = {
				codemarkApply: true,
				codemarkCompare: true,
				editorTrackVisibleRange: true,
				services: {
					vsls: Container.vsls.installed
				}
			};

			// If we have no agent caps then just use the ide's
			if (this._agentCapabilities === undefined) return ide;

			// Mix IDE caps in with the agent caps
			this._capabilities = {
				...this._agentCapabilities,
				...ide
			};
		}

		return this._capabilities;
	}

	private _disposable: Disposable | undefined;

	private _email: string | undefined;
	private _environment: CodeStreamEnvironment | string = CodeStreamEnvironment.Unknown;
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

	private onDocumentMarkersChanged(e: DidChangeDocumentMarkersNotification) {
		this._onDidChangeTextDocumentMarkers.fire(
			new TextDocumentMarkersChangedEvent(this, Uri.parse(e.textDocument.uri))
		);
	}

	private onDataChanged(e: DidChangeDataNotification) {
		switch (e.type) {
			case ChangeDataType.Codemarks:
				this.fireDidChangeCodemarks(new CodemarksChangedEvent(this, e));
				break;
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

	get environment(): CodeStreamEnvironment | string {
		return this._environment;
	}

	get serverUrl(): string {
		return this._serverUrl;
	}
	private setServerUrl(url: string) {
		this._serverUrl = url;
		this._environment = CodeStreamEnvironment.Unknown;

		// FIXME: Must keep this logic in sync with codestream-lsp-agent/src/session.ts
		const match = envRegex.exec(url);
		if (match == null) return;

		const [, subdomain, env] = match;
		if (subdomain != null && subdomain.toLowerCase() === "localhost") {
			this._environment = CodeStreamEnvironment.Local;
			return;
		}

		if (env == null) {
			this._environment = CodeStreamEnvironment.Production;
			return;
		}

		this._environment = env.toLowerCase();
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
		unreads?: Unreads
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

	getSignupToken() {
		if (!this._signupToken) this._signupToken = Functions.uuid();

		return this._signupToken;
	}

	@signedIn
	async getChannelByName(name: string): Promise<ChannelStream | undefined> {
		const response = await Container.agent.streams.fetch([StreamType.Channel]);
		const stream = (response.streams as CSChannelStream[]).find(s => s.name === name);
		if (stream === undefined) return stream;

		return new ChannelStream(this, stream);
	}

	@signedIn
	async getChannelByService(
		type: ChannelServiceType,
		key: string
	): Promise<ChannelStream | undefined> {
		const response = await Container.agent.streams.fetch([StreamType.Channel]);
		const stream = (response.streams as CSChannelStream[]).find(
			s => s.serviceType === type && s.serviceKey === key
		);
		if (stream === undefined) return stream;

		return new ChannelStream(this, stream);
	}

	@signedIn
	async getOrCreateChannelByService(
		type: ChannelServiceType,
		key: string,
		creationOptions: ServiceChannelStreamCreationOptions = {}
	) {
		const stream = await this.getChannelByService(type, key);
		if (stream !== undefined) {
			if (
				stream.memberIds != null &&
				creationOptions.membership != null &&
				typeof creationOptions.membership !== "string"
			) {
				// Ensure correct membership
				const missingIds = creationOptions.membership.filter(id => !stream.memberIds!.includes(id));

				const entity = (await Container.agent.streams.invite(stream.id, missingIds))
					.stream as CSChannelStream;

				return new ChannelStream(this, entity);
			}

			return stream;
		}

		const s = (await Container.agent.streams.createChannel(
			creationOptions.name!,
			creationOptions.membership,
			creationOptions.privacy,
			creationOptions.purpose,
			{
				serviceType: type,
				serviceKey: key,
				serviceInfo: creationOptions.serviceInfo
			}
		)).stream;
		if (s === undefined) throw new Error(`Unable to create stream`);

		return new ChannelStream(this, s);
	}

	@signedIn
	async getOrCreateChannelByName(
		name: string,
		creationOptions: ChannelStreamCreationOptions = {}
	): Promise<ChannelStream> {
		const stream = await this.getChannelByName(name);
		if (stream !== undefined) {
			if (
				stream.memberIds != null &&
				creationOptions.membership != null &&
				typeof creationOptions.membership !== "string"
			) {
				// Ensure correct membership
				const missingIds = creationOptions.membership.filter(id => !stream.memberIds!.includes(id));

				const entity = (await Container.agent.streams.invite(stream.id, missingIds))
					.stream as CSChannelStream;

				return new ChannelStream(this, entity);
			}

			return stream;
		}

		const s = (await Container.agent.streams.createChannel(
			name,
			creationOptions.membership,
			creationOptions.privacy,
			creationOptions.purpose
		)).stream;
		if (s === undefined) throw new Error(`Unable to create stream`);

		return new ChannelStream(this, s);
	}

	@signedIn
	async getDMByMembers(memberIds: string[]): Promise<DirectStream | undefined> {
		const response = await Container.agent.streams.fetch([StreamType.Direct], memberIds);

		const stream = response.streams[0] as CSDirectStream | undefined;
		if (stream === undefined) return stream;

		return new DirectStream(this, stream);
	}

	@signedIn
	async getOrCreateDMByMembers(memberIds: string[]): Promise<DirectStream> {
		const stream = await this.getDMByMembers(memberIds);
		if (stream !== undefined) return stream;

		const s = (await Container.agent.streams.createDirect(memberIds)).stream;
		if (s === undefined) throw new Error(`Unable to create stream`);

		return new DirectStream(this, s);
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

	goOffline() {
		Container.webview.hide();
		return Container.session.logout(SessionSignedOutReason.UserWentOffline);
	}

	async reconnect() {
		Container.webview.hide();
		await Container.session.logout(SessionSignedOutReason.UserWentOffline);
		return Container.commands.signIn();
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
			if (result.error !== LoginResult.NotOnTeam && result.error !== LoginResult.NotConfirmed) {
				this._signupToken = undefined;
			}

			if (result.error === LoginResult.VersionUnsupported) {
				this.showVersionUnsupportedMessage();
			}

			this.setStatus(SessionStatus.SignedOut, SessionSignedOutReason.SignInFailure);

			return result.error;
		}

		await this.completeLogin(result, this._signupToken);
		return LoginResult.Success;
	}

	@log()
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
				if (result.error === LoginResult.VersionUnsupported) {
					this.showVersionUnsupportedMessage();
				} else {
					// Clear the access token
					await TokenManager.clear(this._serverUrl, email);
				}

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
		this._agentCapabilities = result.state.capabilities;

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

	private async showVersionUnsupportedMessage() {
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

function signedIn(target: CodeStreamSession, propertyName: string, descriptor: any) {
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
