"use strict";
import { Connection } from "vscode-languageserver";
import { Config } from "./config";
import { GitService } from "./git/gitService";
import { CodeStreamApi } from "./api/api";
import { DocumentManager } from "./documentManager";
import { CodeStreamAgent, InitializationOptions } from "./agent";

class ServiceContainer {
	public readonly extensionVersion: string;
	public readonly gitPath: string;
	public readonly ideVersion: string;

	constructor(
		public readonly agent: CodeStreamAgent,
		public readonly connection: Connection,
		config: Config,
		initializationOptions: InitializationOptions
	) {
		this.gitPath = initializationOptions.gitPath;
		this.extensionVersion = initializationOptions.extensionVersion;
		this.ideVersion = initializationOptions.ideVersion;

		this._config = config;
		this._api = new CodeStreamApi(
			agent,
			this.config.serverUrl,
			this.ideVersion,
			this.extensionVersion
		);
		this._git = new GitService(agent);

		this._documents = new DocumentManager();
	}

	private _api: CodeStreamApi;
	get api() {
		return this._api;
	}

	private _config: Config;
	get config() {
		return this._config;
	}

	private _documents: DocumentManager;
	get documents() {
		return this._documents;
	}

	private _git: GitService;
	get git() {
		return this._git;
	}

	updateConfig(config: Config) {
		const prevCfg = this._config;

		this._config = {
			...this.config,
			...config
		};

		if (prevCfg.serverUrl !== this._config.serverUrl) {
			this._api = new CodeStreamApi(
				this.agent,
				this.config.serverUrl,
				this.ideVersion,
				this.extensionVersion
			);
		}
	}
}

let container: ServiceContainer;

export namespace Container {
	export async function initialize(
		agent: CodeStreamAgent,
		connection: Connection,
		initializationOptions: InitializationOptions
	) {
		const cfg = (await connection.workspace.getConfiguration("codestream")) as Config;
		container = new ServiceContainer(agent, connection, cfg, initializationOptions);
	}

	export const instance = container;
}
