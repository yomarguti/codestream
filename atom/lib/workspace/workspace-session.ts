import { BootstrapInHostResponse } from "@codestream/protocols/webview";
import { Emitter } from "atom";
import { EnvironmentConfig, getEnvConfigForServerUrl } from "../env-utils";
import {
	Capabilities,
	DidChangeApiVersionCompatibilityNotification,
	isLoginFailResponse,
	LoginFailResponse,
	LoginSuccessResponse,
	OtcLoginRequestType,
	PasswordLoginRequestType,
	TokenLoginRequestType,
	VersionCompatibility,
} from "../protocols/agent/agent.protocol";
import { CSMe, LoginResult } from "../protocols/agent/api.protocol";
import { PackageState } from "../types/package";
import { getPluginVersion } from "../utils";
import { AgentConnection, RequestOf } from "./agent/connection";
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

export enum SignoutReason {
	Extension,
	User,
}

export interface SessionStatusChange {
	current: SessionStatus;
	previous: SessionStatus;
	signoutReason?: SignoutReason;
}

type LoginMethods =
	| typeof PasswordLoginRequestType
	| typeof TokenLoginRequestType
	| typeof OtcLoginRequestType;

const SESSION_STATUS_CHANGED = "session-status-changed";

interface EventEmissions {
	[SESSION_STATUS_CHANGED]: SessionStatusChange;
}

function initializesAgent(target: WorkspaceSession, key: string, descriptor: PropertyDescriptor) {
	const fn = descriptor.value;

	descriptor.value = async function(this: WorkspaceSession, ...args: any[]) {
		await this.initializeAgent();
		return fn.apply(this, args);
	};

	return descriptor;
}

export class WorkspaceSession {
	private emitter: Emitter<{}, EventEmissions>;
	private session?: Session;
	private lastUsedEmail?: string;
	private envConfig: EnvironmentConfig;
	private _agent: AgentConnection;
	get agent() {
		return this._agent;
	}
	private agentCapabilities?: Capabilities;
	private _sessionStatus = SessionStatus.SignedOut;
	private _isReady?: Promise<void>;

	versionCompatibility: VersionCompatibility | undefined;
	lastApiVersionCompatibilityNotification?: DidChangeApiVersionCompatibilityNotification;

	get ready() {
		return this._isReady;
	}

	static create(state: PackageState) {
		let session = state.session;
		if (state.session && state.session.token.url !== Container.configs.get("serverUrl")) {
			session = undefined;
		}
		return new WorkspaceSession(session, state.lastUsedEmail);
	}

	protected constructor(session?: Session, lastUsedEmail?: string) {
		this.session = session;
		this.envConfig = getEnvConfigForServerUrl(Container.configs.get("serverUrl"));
		this.emitter = new Emitter();
		this._agent = new AgentConnection(this.envConfig);
		this.lastUsedEmail = lastUsedEmail;
		this.initialize();
	}

	private initialize() {
		this._isReady = new Promise(async (resolve, reject) => {
			try {
				await this.initializeAgent();

				if (Container.configs.get("autoSignIn") && this.session) {
					const result = await this.login(TokenLoginRequestType, { token: this.session!.token });
					if (result !== LoginResult.Success) {
						this.session = undefined;
					}
				}

				resolve();
			} catch (error) {
				reject();
			}
		});
	}

	async initializeAgent() {
		if (this._agent.initialized) return;

		this._agent.onDidRequireRestart(() => {
			this.restart();
		});
		this._agent.onDidCrash(() => this.signOut());
		this._agent.onDidStartLogin(() => this.setStatus(SessionStatus.SigningIn));
		this._agent.onDidFailLogin(() => this.setStatus(SessionStatus.SignedOut));
		this._agent.onDidLogin(event => this.completeLogin(event.data));

		await this.agent.start();
	}

	get isSignedIn() {
		return this._sessionStatus === SessionStatus.SignedIn;
	}

	serialize() {
		return {
			session: this.session,
			lastUsedEmail: this.session ? this.session.user.email : this.lastUsedEmail,
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

	private setStatus(status: SessionStatus, signoutReason?: SignoutReason) {
		if (this._sessionStatus !== status) {
			const previous = this._sessionStatus;
			this._sessionStatus = status;
			this.emitter.emit(SESSION_STATUS_CHANGED, { current: status, previous, signoutReason });
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
			codemarkApply: true,
			codemarkCompare: true,
			editorTrackVisibleRange: true,
			openLink: true,
			services: {},
		};
		if (!this.agentCapabilities) {
			return editorCapabilities;
		}
		return { ...editorCapabilities, ...this.agentCapabilities };
	}

	getBootstrapInfo(): Pick<
		BootstrapInHostResponse,
		| "session"
		| "capabilities"
		| "configs"
		| "version"
		| "ide"
		| "versionCompatibility"
		| "apiVersionCompatibility"
		| "missingCapabilities"
	> {
		const apiCompability: Partial<DidChangeApiVersionCompatibilityNotification> =
			this.lastApiVersionCompatibilityNotification || {};

		return {
			versionCompatibility: this.versionCompatibility,
			apiVersionCompatibility: apiCompability.compatibility,
			missingCapabilities: apiCompability.missingCapabilities,
			session: { userId: this.isSignedIn ? this.user!.id : undefined },
			capabilities: this.capabilities,
			configs: Container.configs.getForWebview(this.lastUsedEmail),
			version: getPluginVersion(),
			ide: { name: "Atom" },
		};
	}

	private getTeamPreference(): { teamId?: string; team?: string } {
		if (this.session) return { teamId: this.session.teamId };

		const teamSetting = Container.configs.get("team");
		if (teamSetting.length > 0) return { team: teamSetting };

		return {};
	}

	async login<RT extends LoginMethods>(requestType: RT, request: RequestOf<RT>) {
		this.setStatus(SessionStatus.SigningIn);
		try {
			const response: LoginSuccessResponse | LoginFailResponse = await this._agent.request(
				requestType,
				{
					...request,
					...this.getTeamPreference(),
				}
			);

			if (isLoginFailResponse(response)) {
				this.setStatus(SessionStatus.SignedOut);
				return response.error;
			}

			await this.completeLogin(response);
			this.setStatus(SessionStatus.SignedIn);
			return LoginResult.Success;
		} catch (error) {
			this.setStatus(SessionStatus.SignedOut);
			if (typeof error === "string") {
				atom.notifications.addError("Error logging in: ", { detail: error });
				return error as LoginResult;
			} else {
				console.error("Unexpected error signing into CodeStream", error);
				return LoginResult.Unknown;
			}
		}
	}

	private completeLogin(agentResult: LoginSuccessResponse) {
		this.session = {
			user: agentResult.loginResponse.user,
			teamId: agentResult.state.teamId,
			token: agentResult.state.token,
		};
		this.lastUsedEmail = agentResult.loginResponse.user.email;
		this.agentCapabilities = agentResult.state.capabilities;
		this.setStatus(SessionStatus.SignedIn);
	}

	async signOut(reason = SignoutReason.Extension) {
		await this._agent.reset();
		if (this.session) {
			this.session = undefined;
			this.setStatus(SessionStatus.SignedOut, reason);
		}
	}

	async restart(reason?: SignoutReason) {
		this.envConfig = getEnvConfigForServerUrl(Container.configs.get("serverUrl"));
		await this.signOut(reason);
	}
}
