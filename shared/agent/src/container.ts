"use strict";
import { Connection } from "vscode-languageserver";
import { Config } from "./config";
import { GitService } from "./git/gitService";
import { CodeStreamApi, LoginResponse } from "./api/api";
import { DocumentManager } from "./documentManager";
import { CodeStreamAgent, CodeStreamAgentOptions } from "./agent";
import { Logger } from "./logger";

class ServiceContainer {
	public readonly extensionVersion: string;
	public readonly gitPath: string;
	public readonly ideVersion: string;

	public readonly state: {
		email: string;
		userId: string;
		teamId: string;
		token: string;
		serverUrl: string;
	};

	constructor(
		public readonly agent: CodeStreamAgent,
		public readonly connection: Connection,
		public readonly api: CodeStreamApi,
		options: CodeStreamAgentOptions,
		loginResponse: LoginResponse
	) {
		this.gitPath = options.gitPath;
		this.extensionVersion = options.extensionVersion;
		this.ideVersion = options.ideVersion;

		this.state = {
			email: options.email,
			userId: loginResponse.user.id,
			teamId: options.teamId,
			token: options.token,
			serverUrl: options.serverUrl
		};

		// this._config = {
		// 	email: options.email,
		// 	password: options.token,
		// 	serverUrl: options.serverUrl!,
		// 	team: undefined!,
		// 	teamId: undefined!,
		// 	token: undefined!
		// };

		this._git = new GitService(agent);

		this._documents = new DocumentManager();
	}

	// private _config: Config;
	// get config() {
	// 	return this._config;
	// }

	private _documents: DocumentManager;
	get documents() {
		return this._documents;
	}

	private _git: GitService;
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
}

let container: ServiceContainer | undefined;

export namespace Container {
	export async function initialize(
		agent: CodeStreamAgent,
		connection: Connection,
		api: CodeStreamApi,
		options: CodeStreamAgentOptions,
		loginResponse: LoginResponse
	) {
		container = new ServiceContainer(agent, connection, api, options, loginResponse);
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
