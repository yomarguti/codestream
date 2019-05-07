import { Emitter } from "atom";
import uuidv4 from "uuid/v4";
import { EnvironmentConfig, PRODUCTION_CONFIG } from "../env-utils";
import { AccessToken, AgentResult, Capabilities } from "../protocols/agent/agent.protocol";
import { CSMe, LoginResult } from "../protocols/agent/api.protocol";
import { PackageState } from "../types/package";
import { getPluginVersion } from "../utils";
import { CodeStreamAgent } from "./agent";
import { Container } from "./container";

export interface Session {
	user: CSMe;
	teamId: string;
	token: {
		url: string;
		email: string;
		value: string;
	};
}

export enum SessionStatus {
	SignedOut,
	SigningIn,
	SignedIn,
}

export interface SessionStatusChange {
	current: SessionStatus;
	previous: SessionStatus;
}

const SESSION_STATUS_CHANGED = "session-status-changed";

interface EventEmissions {
	[SESSION_STATUS_CHANGED]: SessionStatusChange;
}

export class WorkspaceSession {
	private emitter: Emitter<{}, EventEmissions>;
	private session?: Session;
	private lastUsedEmail?: string;
	private envConfig: EnvironmentConfig;
	private signupToken?: string;
	private _agent: CodeStreamAgent;
	get agent() {
		return this._agent;
	}
	private agentCapabilities?: Capabilities;
	private _sessionStatus = SessionStatus.SignedOut;
	private _isReady?: Promise<void>;
	get ready() {
		return this._isReady;
	}

	static create(state: PackageState) {
		return new WorkspaceSession(state.session, state.lastUsedEmail, state.environment);
	}

	protected constructor(
		session?: Session,
		lastUsedEmail?: string,
		envConfig: EnvironmentConfig = PRODUCTION_CONFIG
	) {
		this.emitter = new Emitter();
		this._agent = new CodeStreamAgent();
		this.session = session;
		this.lastUsedEmail = lastUsedEmail;
		this.envConfig = envConfig;

		if (session && Container.configs.get("autoSignIn")) {
			this._isReady = new Promise(async (resolve, reject) => {
				const result = await this.login(session.user.email, session.token);
				if (result === LoginResult.Success) {
					resolve();
				} else {
					this.session = undefined;
					this._isReady = undefined;
					reject();
				}
			});
		}
	}

	get isSignedIn() {
		return this._sessionStatus === SessionStatus.SignedIn;
	}

	serialize() {
		return {
			session: this.session,
			lastUsedEmail: this.session ? this.session.user.email : this.lastUsedEmail,
			environment: this.envConfig,
		};
	}

	dispose() {
		this.signOut();
	}

	observeSessionStatus(callback: (status: SessionStatus) => void) {
		callback(this.status);
		return this.onDidChangeSessionStatus(change => callback(change.current));
	}

	onDidChangeSessionStatus(callback: (change: SessionStatusChange) => void) {
		return this.emitter.on(SESSION_STATUS_CHANGED, callback);
	}

	private set sessionStatus(status: SessionStatus) {
		if (this._sessionStatus !== status) {
			const previous = this._sessionStatus;
			this._sessionStatus = status;
			this.emitter.emit(SESSION_STATUS_CHANGED, { current: status, previous });
		}
	}

	get status() {
		return this._sessionStatus;
	}

	get user() {
		return this.session && this.session.user;
	}

	get teamId() {
		return this.session && this.session.teamId;
	}

	get environment() {
		return this.envConfig;
	}

	get capabilities() {
		const editorCapabilities = {
			codemarkApply: false,
			codemarkCompare: false,
			editorTrackVisibleRange: true,
			openLink: true,
			services: {},
		};
		if (!this.agentCapabilities) {
			return editorCapabilities;
		}
		return { ...editorCapabilities, ...this.agentCapabilities };
	}

	getBootstrapInfo() {
		return {
			capabilities: this.capabilities,
			configs: Container.configs.getForWebview(this.environment.serverUrl, this.lastUsedEmail),
			version: getPluginVersion(),
		};
	}

	private getTeamPreference() {
		if (this.session) return { teamId: this.session.teamId };

		const teamSetting = Container.configs.get("team");
		if (teamSetting.length > 0) return { team: teamSetting };
	}

	getSignupToken() {
		if (!this.signupToken) {
			this.signupToken = uuidv4();
		}
		return this.signupToken;
	}

	async login(email: string, passwordOrToken: string | AccessToken) {
		this.sessionStatus = SessionStatus.SigningIn;
		try {
			const result = await this._agent.init(
				email,
				passwordOrToken,
				this.environment.serverUrl,
				this.getTeamPreference()
			);
			await this.completeLogin(result);
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
			const result = await this._agent.initWithSignupToken(
				this.signupToken || token!,
				this.environment.serverUrl,
				this.getTeamPreference()
			);
			await this.completeLogin(result);
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

	private completeLogin(agentResult: AgentResult) {
		this.session = {
			user: agentResult.loginResponse.user,
			teamId: agentResult.state.teamId,
			token: {
				url: this.environment.serverUrl,
				email: agentResult.loginResponse.user.email,
				value: agentResult.loginResponse.accessToken,
			},
		};
		this.lastUsedEmail = agentResult.loginResponse.user.email;
		this.agentCapabilities = agentResult.state.capabilities;
		this.sessionStatus = SessionStatus.SignedIn;
	}

	signOut() {
		if (this.session) {
			this.session = undefined;
			this._agent.dispose();
			this._agent = new CodeStreamAgent();
			this.sessionStatus = SessionStatus.SignedOut;
		}
	}

	changeEnvironment(env: EnvironmentConfig) {
		this.signOut();
		this.envConfig = env;
	}
}
