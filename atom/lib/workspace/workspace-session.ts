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
	teamId: string;
	token: string;
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

const DID_CHANGE_SESSION_STATUS = "session-status-changed";

export class WorkspaceSession {
	private emitter: Emitter;
	private session?: Session;
	private lastUsedEmail: string;
	private envConfig: EnvironmentConfig;
	private signupToken?: string;
	private _agent?: CodeStreamAgent;
	get agent() {
		return this._agent;
	}
	private agentCapabilities?: Capabilities;
	private _sessionStatus = SessionStatus.SignedOut;
	private isReady?: Promise<void>;

	static create(state: PackageState) {
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

		if (session) {
			this.isReady = new Promise(async (resolve, reject) => {
				const result = await this.login(session.user.email, session.token);
				if (result === LoginResult.Success) {
					resolve();
				} else {
					this.session = undefined;
					this.isReady = undefined;
					reject();
				}
			});
		}
	}

	serialize() {
		return {
			session: this.session,
			lastUsedEmail: this.session ? this.session.user.email : this.lastUsedEmail,
			environment: this.envConfig,
		};
	}

	dispose() {
		if (this._agent) this._agent.dispose();
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

	async getBootstrapData() {
		if (!this.session) return {};
		try {
			await this.isReady;
		} catch (error) {
			return {};
		}

		const promise = Promise.all([
			this._agent!.fetchUsers(),
			this._agent!.fetchStreams(),
			this._agent!.fetchTeams(),
			this._agent!.fetchRepos(),
			this._agent!.fetchUnreads(),
			this._agent!.fetchPreferences(),
		]);

		const data: any = {
			currentTeamId: this.session.teamId,
			currentUserId: this.session.user.id,
			context: {
				currentTeamId: this.session.teamId,
			},
			session: {
				userId: this.session.user.id,
			},
			capabilities: this.agentCapabilities,
			configs: { debug: true, serverUrl: this.environment.serverUrl }, // TODO
			preferences: {}, // TODO
			umis: {}, // TODO
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

	async login(email: string, token: string) {
		this.sessionStatus = SessionStatus.SigningIn;
		try {
			this._agent = await CodeStreamAgent.init(email, token, this.environment.serverUrl);
			await this.completeLogin();
			this.sessionStatus = SessionStatus.SignedIn;
			return LoginResult.Success;
		} catch (error) {
			this.sessionStatus = SessionStatus.SignedOut;
			if (typeof error === "string") {
				atom.notifications.addError("Error logging in: ", { detail: error });
				return error as LoginResult;
			} else {
				console.error("Unexpected error signing into CodeStream", error);
				return LoginResult.Unknown;
			}
		}
	}

	async loginViaSignupToken(token?: string): Promise<LoginResult> {
		if (this.signupToken === undefined && token === undefined) {
			throw new Error("A signup token hasn't been generated");
		}
		this.sessionStatus = SessionStatus.SigningIn;
		try {
			this._agent = await CodeStreamAgent.initWithSignupToken(
				this.signupToken || token!,
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
				atom.notifications.addError("Unexpected error intializing agent with signup token");
				console.error("Unexpected error intializing agent with signup token", error);
				return LoginResult.Unknown;
			}
		}
	}

	private completeLogin() {
		const agentResult = this._agent!.initializeResult;
		this.session = {
			user: agentResult.loginResponse.user,
			teamId: agentResult.state.teamId,
			token: agentResult.loginResponse.accessToken,
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
		if (this._agent) {
			this._agent.dispose();
			this._agent = undefined;
		}
	}

	changeEnvironment(env: EnvironmentConfig) {
		this.signOut();
		this.envConfig = env;
	}
}
