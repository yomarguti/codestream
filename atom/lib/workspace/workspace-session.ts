import { Emitter } from "atom";
import * as uuid from "uuid/v4";
import { getPluginVersion } from "../utils";
import { CodeStreamAgent } from "./agent";
import { CSMe, LoginResult } from "../shared/api.protocol";
import { EnvironmentConfig, PRODUCTION_CONFIG } from "../env-utils";
import { PackageState } from "lib/types/package";
import { Capabilities } from "lib/shared/agent.protocol";

export type Session = {
	user: CSMe;
	currentTeamId: string;
};

interface BootstrapState {
	context?: {
		[key: string]: any;
	};
	capabilities: Capabilities;
	// currentTeamId: string;
	// currentUserId: string;
	// currentStreamId: string;
	// currentThreadId?: string;
	// posts: CSPost[];
	// streams: CSStream[];
	// teams: CSTeam[];
	// users: CSUser[];
	// unreads: CSUnreads;
	// repos: CSRepository[];
	// version: string;
	// preferences: CSMePreferences;
	// configs: {
	// 	[k: string]: any;
	// };
	// panelStack?: string[];
}

export enum SessionStatus {
	SignedOut,
	SigningIn,
	SignedIn,
}

const DID_CHANGE_SESSION_STATUS = "did-change-session-status";

export class WorkspaceSession {
	private emitter: Emitter;
	private session?: Session;
	private lastUsedEmail: string;
	private envConfig: EnvironmentConfig;
	private signupToken?: string;
	private agent?: CodeStreamAgent;
	private agentCapabilities?: Capabilities;
	private _sessionStatus = SessionStatus.SignedOut;

	static create(state: PackageState) {
		console.debug("creating a session with", state);
		return new WorkspaceSession(state.session, state.lastUsedEmail, state.environment);
	}

	protected constructor(
		session?: Session,
		lastUsedEmail = "",
		envConfig: EnvironmentConfig = PRODUCTION_CONFIG
	) {
		this.emitter = new Emitter();
		this.session = session;
		this.lastUsedEmail = lastUsedEmail;
		this.envConfig = envConfig;

		// this.popupManager = new AddCommentPopupManager(repoAttributes.workingDirectory);
		// this.bufferChangeTracker = new BufferChangeTracker(this.store, repoAttributes.workingDirectory);
		// this.diffManager = new DiffManager(this.store);
		// this.contentHighlighter = new ContentHighlighter(this.store);
		// this.markerLocationTracker = new MarkerLocationTracker(this.store);
		// this.editTracker = new EditTracker(this.store);
		// this.initialized = true;
	}

	serialize() {
		return {
			session: this.session,
			lastUsedEmail: this.session ? this.session.user.email : this.lastUsedEmail,
			environment: this.envConfig,
		};
	}

	dispose() {
		if (this.agent) this.agent.dispose();
		this.emitter.dispose();
	}

	onDidChangeSessionStatus(callback: (status: SessionStatus) => any) {
		this.emitter.on(DID_CHANGE_SESSION_STATUS, callback);
		callback(this._sessionStatus);
	}

	private set sessionStatus(status: SessionStatus) {
		if (this._sessionStatus !== status) {
			this._sessionStatus = status;
			this.emitter.emit(DID_CHANGE_SESSION_STATUS, status);
		}
	}

	get user() {
		return this.session && this.session.user;
	}

	get environment() {
		return this.envConfig;
	}

	getBootstrapState() {
		return {
			configs: { email: this.lastUsedEmail },
			pluginVersion: getPluginVersion(),
			...(this.lastUsedEmail !== "" ? { route: { route: "login" } } : {}),
		};
	}

	// only when there is a session
	async getBootstrapData() {
		if (!this.session) return;

		const promise = Promise.all([
			this.agent!.fetchUsers(),
			this.agent!.fetchStreams(),
			this.agent!.fetchTeams(),
			this.agent!.fetchRepos(),
			this.agent!.fetchUnreads(),
			this.agent!.fetchPreferences(),
		]);

		const data: any = {
			currentTeamId: this.session.currentTeamId,
			currentUserId: this.session.user.id,
			capabilities: this.agentCapabilities,
			configs: { debug: true, serverUrl: this.environment.serverUrl }, // TODO
			preferences: {}, // TODO
			umis: {}, // TODO
			// context // TODO?
		};
		const [
			usersResponse,
			streamsResponse,
			teamsResponse,
			reposResponse,
			unreadsResponse,
			preferencesResponse,
		] = await promise;

		data.users = usersResponse.users;
		data.streams = streamsResponse.streams;
		data.teams = teamsResponse.teams;
		data.repos = reposResponse.repos;
		data.unreads = unreadsResponse.unreads;
		data.preferences = preferencesResponse.preferences;

		return data;
	}

	getSignupToken() {
		if (!this.signupToken) {
			this.signupToken = uuid();
		}
		return this.signupToken;
	}

	async loginViaSignupToken(): Promise<LoginResult> {
		if (this.signupToken === undefined) {
			throw new Error("A signup token hasn't been generated");
		}
		this.sessionStatus = SessionStatus.SigningIn;
		try {
			this.agent = await CodeStreamAgent.initWithSignupToken(
				this.signupToken,
				this.environment.serverUrl
			);
			await this.completeLogin();
			return LoginResult.Success;
		} catch (error) {
			this.sessionStatus = SessionStatus.SignedOut;
			if (typeof error === "string") {
				if (error !== LoginResult.NotOnTeam && error !== LoginResult.NotConfirmed) {
					this.signupToken = undefined;
				}
				return error as LoginResult;
			} else {
				console.error("Unexpected error intializing agent with signup token", error);
				return LoginResult.Unknown;
			}
		}
	}

	private completeLogin() {
		const agentResult = this.agent!.initializeResult;
		this.session = {
			user: agentResult.loginResponse.user,
			currentTeamId: agentResult.state.teamId,
		};
		this.lastUsedEmail = agentResult.loginResponse.user.email;
		this.agentCapabilities = agentResult.state.capabilities;
		this.sessionStatus = SessionStatus.SignedIn;
	}

	signOut() {
		if (this.session) {
			this.session = undefined;
			this.sessionStatus = SessionStatus.SignedOut;
		}
		if (this.agent) {
			this.agent.dispose();
			this.agent = undefined;
		}
	}
}
