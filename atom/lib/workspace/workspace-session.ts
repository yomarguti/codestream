import * as uuid from "uuid/v4";
import { getPluginVersion } from "../utils";
// import Agent from "./agent";
import { CSMe } from "lib/shared/api.protocol";
import { EnvironmentConfig, PRODUCTION_CONFIG } from "../env-utils";
import { PackageState } from "lib/types/package";

export type Session = {
	user: CSMe;
	teamIds: string[];
	currentTeamId: string;
};

export class WorkspaceSession {
	private session?: Session;
	private lastUsedEmail: string;
	private envConfig: EnvironmentConfig;
	private signupToken?: string;

	static create(state: PackageState) {
		return new WorkspaceSession(state.session, state.lastUsedEmail, state.environment);
	}

	protected constructor(
		session?: Session,
		lastUsedEmail = "",
		envConfig: EnvironmentConfig = PRODUCTION_CONFIG,
	) {
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
			lastUsedEmail: this.lastUsedEmail,
			environment: this.envConfig,
		};
	}

	get environment() {
		return this.envConfig;
	}

	getBootstrapState() {
		return {
			pluginVersion: getPluginVersion(),
			context: { currentTeamId: this.session && this.session.currentTeamId, hasFocus: true },
			session: { userId: this.session && this.session.user.id },
			umis: {}, // TODO
			preferences: {}, // TODO
			capabilities: {}, // TODO
			configs: {}, // TODO
			...(this.lastUsedEmail !== "" ? { route: { route: "login" } } : {}),
		};
	}

	getBootstrapData() {
		return {}; // TODO
	}

	getSignupToken() {
		if (!this.signupToken) {
			this.signupToken = uuid();
		}
		return this.signupToken;
	}
}
