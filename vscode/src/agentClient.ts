"use strict";
import { RequestInit } from "node-fetch";
import { ExtensionContext, Uri } from "vscode";
import {
	Disposable,
	InitializeResult,
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from "vscode-languageclient";
import { LoginResponse } from "./api/types";
import { getRepositories, GitApiRepository } from "./git/git";
import { GitRepository } from "./git/gitService";
import { Logger } from "./logger";

// TODO: Fix this, but for now keep in sync with InitializationOptions in agent.ts in codestream-lsp-agent
export interface CodeStreamAgentOptions {
	extensionVersion: string;
	gitPath: string;
	ideVersion: string;

	serverUrl?: string;
	email?: string;
	team?: string;
	teamId?: string;
	token?: string;
}

export interface CodeStreamAgentResult {
	loginResponse: LoginResponse;
	state: {
		email: string;
		userId: string;
		teamId: string;
		token: string;
		serverUrl: string;
	};
}

export class CodeStreamAgentClient implements Disposable {
	private _client: LanguageClient | undefined;
	private _disposable: Disposable | undefined;

	private _clientOptions: LanguageClientOptions;
	private _serverOptions: ServerOptions;

	constructor(context: ExtensionContext, options: CodeStreamAgentOptions) {
		// If the extension is launched in debug mode then the debug server options are used
		// Otherwise the run options are used
		this._serverOptions = {
			run: {
				module: context.asAbsolutePath("agent.js"),
				transport: TransportKind.ipc
			},
			debug: {
				module: context.asAbsolutePath("dist/agent.js"),
				transport: TransportKind.ipc,
				options: {
					execArgv: ["--nolazy", "--inspect=6009"] // "--inspect-brk=6009"
				}
			}
		};

		// Options to control the language client
		this._clientOptions = {
			initializationOptions: { ...options },
			// Register the server for file-based text documents
			documentSelector: [{ scheme: "file", language: "*" }],
			synchronize: {
				// Synchronize the setting section 'codestream' to the server
				configurationSection: "codestream"
			}
		};
	}

	dispose() {
		this._disposable && this._disposable.dispose();
	}

	get started() {
		return this._client && !this._client.needsStart();
	}

	@started
	async api<R>(url: string, init?: RequestInit, token?: string) {
		return this.sendRequest<R>("codeStream/api", {
			url,
			token,
			init
		});
	}

	@started
	async getMarkers(uri: Uri): Promise<any> {
		try {
			const response = await this.sendRequest("codeStream/textDocument/markers", {
				textDocument: { uri: uri.toString(true) }
			});
			return response;
		} catch (ex) {
			debugger;
			Logger.error(ex);
			throw ex;
		}
	}

	@started
	async getRepositories(): Promise<GitRepository[]> {
		try {
			const response = await this.sendRequest<GitApiRepository[]>("codeStream/git/repos");
			const repositories = response.map(r => new GitRepository(Uri.parse(r.rootUri as string)));
			return repositories;
		} catch (ex) {
			debugger;
			Logger.error(ex);
			throw ex;
		}
	}

	async login(
		email: string,
		token: string,
		teamId?: string,
		team?: string
	): Promise<CodeStreamAgentResult> {
		const response = await this.start({
			...this._clientOptions.initializationOptions,
			email: email,
			token: token,
			team,
			teamId
		});

		return response.result as CodeStreamAgentResult;
	}

	async logout() {
		void (await this.stop());
	}

	private async onGitReposRequest(method: string, ...params: any[]): Promise<GitApiRepository[]> {
		const repos = await getRepositories();
		return repos.map(r => ({ rootUri: r.rootUri.toString() }));
	}

	@started
	private async sendRequest<R>(method: string, params?: any): Promise<R> {
		try {
			const response = await this._client!.sendRequest<R>(method, params);
			return response;
		} catch (ex) {
			debugger;
			Logger.error(ex, `CodeStreamAgentClient.sendRequest`, method, params);
			throw ex;
		}
	}
	private async start(options: Required<CodeStreamAgentOptions>): Promise<InitializeResult> {
		if (this._client !== undefined) {
			throw new Error("Agent has already been started");
		}

		const clientOptions = {
			...this._clientOptions,
			initializationOptions: options
		};

		this._client = new LanguageClient(
			"codestream",
			"CodeStream",
			{ ...this._serverOptions } as ServerOptions,
			clientOptions
		);
		this._client.registerProposedFeatures();

		this._disposable = this._client.start();
		void (await this._client.onReady());

		this._client.onRequest<any, Promise<GitApiRepository[]>>(
			"codeStream/git/repos",
			this.onGitReposRequest.bind(this)
		);

		return this._client.initializeResult!;
	}

	private async stop(): Promise<void> {
		if (this._client === undefined) return;

		this._disposable && this._disposable.dispose();
		await this._client.stop();

		this._client = undefined;
	}
}

function started(
	target: CodeStreamAgentClient,
	propertyName: string,
	descriptor: TypedPropertyDescriptor<any>
) {
	if (typeof descriptor.value === "function") {
		const method = descriptor.value;
		descriptor.value = function(this: CodeStreamAgentClient, ...args: any[]) {
			if (!this.started) throw new Error("CodeStream Agent has not been started");
			return method!.apply(this, args);
		};
	} else if (typeof descriptor.get === "function") {
		const get = descriptor.get;
		descriptor.get = function(this: CodeStreamAgentClient, ...args: any[]) {
			if (!this.started) throw new Error("CodeStream Agent has not been started");
			return get!.apply(this, args);
		};
	}
}
