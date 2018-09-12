"use strict";
import { AgentOptions, AgentState, CodeStreamEnvironment } from "./agent";
import { CodeStreamApi, LoginResponse } from "./api/api";
import { Config } from "./config";
import { DocumentManager } from "./documentManager";
import { GitService } from "./git/gitService";
import { Logger } from "./logger";
import { CodeStreamSession } from "./session";

const envRegex = /https?:\/\/(pd-|qa-)?api.codestream.(?:us|com)/;

class ServiceContainer {
	public readonly extensionVersion: string;
	public readonly gitPath: string;
	public readonly ideVersion: string;

	public readonly state: AgentState;

	constructor(
		public readonly session: CodeStreamSession,
		public readonly api: CodeStreamApi,
		options: AgentOptions,
		loginResponse: LoginResponse
	) {
		this.gitPath = options.gitPath;
		this.extensionVersion = options.extensionVersion;
		this.ideVersion = options.ideVersion;

		this.state = {
			apiToken: loginResponse.accessToken,
			email: options.email,
			environment: this.getEnvironment(options.serverUrl),
			teamId: options.teamId,
			serverUrl: options.serverUrl,
			userId: loginResponse.user.id
		};

		this._git = new GitService(session, api);

		this._documents = new DocumentManager();
		this._documents.listen(session.connection);
	}

	private readonly _documents: DocumentManager;
	get documents() {
		return this._documents;
	}

	private readonly _git: GitService;
	get git() {
		return this._git;
	}

	updateConfig(config: Config) {
		// 	const prevCfg = this._config;
		// 	this._config = {
		// 		...this.config,
		// 		...config
		// 	};
		// 	if (prevCfg && prevCfg.serverUrl !== this._config.serverUrl) {
		// 		this.api.baseUrl = this.config.serverUrl;
		// 	}
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

let container: ServiceContainer | undefined;

export namespace Container {
	export async function initialize(
		session: CodeStreamSession,
		api: CodeStreamApi,
		options: AgentOptions,
		loginResponse: LoginResponse
	) {
		container = new ServiceContainer(session, api, options, loginResponse);
	}

	export function instance(): ServiceContainer {
		if (container === undefined) {
			debugger;
			const ex = new Error("Container not yet initialized.");
			Logger.error(ex);
			throw ex;
		}

		return container;
	}
}
