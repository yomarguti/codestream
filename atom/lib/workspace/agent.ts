import { ChildProcess, spawn } from "child_process";
import { Convert, LanguageClientConnection } from "atom-languageclient";
import {
	createMessageConnection,
	IPCMessageReader,
	IPCMessageWriter,
} from "atom-languageclient/node_modules/vscode-jsonrpc";
import { asAbsolutePath, getPluginVersion } from "../utils";
import {
	AgentOptions,
	AgentInitializeResult,
	AgentResult,
	FetchUsersRequestType,
	FetchStreamsRequestType,
	FetchTeamsRequestType,
	FetchReposRequestType,
	GetUnreadsRequestType,
	GetPreferencesRequestType,
	FetchUsersResponse,
	FetchStreamsResponse,
	FetchTeamsResponse,
	FetchReposResponse,
	GetUnreadsResponse,
	GetPreferencesResponse,
	TraceLevel,
	AccessToken,
} from "../shared/agent.protocol";
import { ClientCapabilities, LogMessageParams } from "vscode-languageserver-protocol";

const capabilities: ClientCapabilities = {
	workspace: {
		applyEdit: true,
		configuration: false,
		workspaceEdit: {
			documentChanges: true,
		},
		workspaceFolders: false,
		didChangeConfiguration: {
			dynamicRegistration: false,
		},
		didChangeWatchedFiles: {
			dynamicRegistration: false,
		},
		symbol: {
			dynamicRegistration: false,
		},
		executeCommand: {
			dynamicRegistration: false,
		},
	},
	textDocument: {
		synchronization: {
			dynamicRegistration: false,
			willSave: true,
			willSaveWaitUntil: true,
			didSave: true,
		},
		completion: {
			dynamicRegistration: false,
			completionItem: {
				snippetSupport: true,
				commitCharactersSupport: false,
			},
			contextSupport: true,
		},
		hover: {
			dynamicRegistration: false,
		},
		signatureHelp: {
			dynamicRegistration: false,
		},
		references: {
			dynamicRegistration: false,
		},
		documentHighlight: {
			dynamicRegistration: false,
		},
		documentSymbol: {
			dynamicRegistration: false,
			hierarchicalDocumentSymbolSupport: true,
		},
		formatting: {
			dynamicRegistration: false,
		},
		rangeFormatting: {
			dynamicRegistration: false,
		},
		onTypeFormatting: {
			dynamicRegistration: false,
		},
		definition: {
			dynamicRegistration: false,
		},
		codeAction: {
			dynamicRegistration: false,
		},
		codeLens: {
			dynamicRegistration: false,
		},
		documentLink: {
			dynamicRegistration: false,
		},
		rename: {
			dynamicRegistration: false,
		},

		// We do not support these features yet.
		// Need to set to undefined to appease TypeScript weak type detection.
		implementation: undefined,
		typeDefinition: undefined,
		colorProvider: undefined,
		foldingRange: undefined,
	},
	experimental: {},
};

// TODO: build a log view

class AgentConnection {
	private _connection: LanguageClientConnection | undefined;
	private _agentProcess: ChildProcess | undefined;

	get connection() {
		return this._connection;
	}

	async start(initOptions: {
		serverUrl: string;
		email?: string;
		teamId?: string;
		passwordOrToken?: string | AccessToken;
		signupToken?: string;
	}) {
		this._agentProcess = await this.startServer();

		this._connection = new LanguageClientConnection(
			createMessageConnection(
				new IPCMessageReader(this._agentProcess as ChildProcess),
				new IPCMessageWriter(this._agentProcess as ChildProcess)
			)
		);
		this.preInitialization(this._connection);

		const initializationOptions: Partial<AgentOptions> = {
			extension: {
				build: "dev",
				buildEnv: "local",
				version: getPluginVersion(),
				versionFormatted: "dev",
			},
			ide: {
				name: "atom",
				version: atom.getVersion(),
			},
			isDebugging: true,
			traceLevel: TraceLevel.Debug,
			gitPath: "git",
			...initOptions,
		};

		const firstProject = atom.project.getPaths()[0] || null; // TODO: what if there are no projects
		const response = await this._connection.initialize({
			processId: this._agentProcess.pid,
			workspaceFolders: [],
			rootUri: firstProject ? Convert.pathToUri(firstProject) : null,
			capabilities,
			initializationOptions,
		});

		if (response.result.error) {
			this.stop();
		}
		return (response as AgentInitializeResult).result;
	}

	private preInitialization(connection: LanguageClientConnection) {
		connection.onLogMessage((params: LogMessageParams) => {
			console.debug(`CodeStream Agent: ${params.message}`);
		});
	}

	private startServer(): ChildProcess {
		const options: { [k: string]: any } = {};
		options.env = Object.create(process.env);
		options.env.ELECTRON_RUN_AS_NODE = "1";
		options.env.ELECTRON_NO_ATTACH_CONSOLE = "1";
		options.stdio = [null, null, null, "ipc"];

		const agentProcess = spawn(
			process.execPath,
			[asAbsolutePath("dist/agent.js"), "--node-ipc", "--inspect=6011"],
			options
		);
		// agentProcess.on("disconnect", () => {
		// 	console.error("disconnected");
		// });
		// agentProcess.on("exit", code => {
		// 	console.error("exited", code);
		// });
		agentProcess.on("message", message => {
			// console.debug("message", message);
		});
		return agentProcess;
	}

	async stop() {
		if (this._connection) {
			await this._connection.shutdown();
			this._connection.exit();
			this._connection.dispose();
			this._connection = undefined;
		}
		if (this._agentProcess) {
			this._agentProcess.kill();
			this._agentProcess = undefined;
		}
	}
}

export class CodeStreamAgent {
	private connection: AgentConnection;
	readonly initializeResult: AgentResult;

	static async initWithSignupToken(token: string, serverUrl: string): Promise<CodeStreamAgent> {
		const connection = new AgentConnection();
		const result = await connection.start({ signupToken: token, serverUrl });
		if (result.error) {
			throw result.error;
		} else return new CodeStreamAgent(connection, result);
	}

	static async init(email: string, token: string, serverUrl: string): Promise<CodeStreamAgent> {
		const connection = new AgentConnection();
		const result = await connection.start({
			email,
			passwordOrToken: { email, url: serverUrl, value: token },
			serverUrl,
		});
		if (result.error) throw result.error;
		else return new CodeStreamAgent(connection, result);
	}

	protected constructor(connection: AgentConnection, data: AgentResult) {
		this.connection = connection;
		this.initializeResult = data;
	}

	fetchUsers(): Promise<FetchUsersResponse> {
		return this.connection.connection!.sendCustomRequest(FetchUsersRequestType.method, {});
	}

	fetchStreams(): Promise<FetchStreamsResponse> {
		return this.connection.connection!.sendCustomRequest(FetchStreamsRequestType.method, {});
	}

	fetchTeams(): Promise<FetchTeamsResponse> {
		return this.connection.connection!.sendCustomRequest(FetchTeamsRequestType.method, {});
	}

	fetchRepos(): Promise<FetchReposResponse> {
		return this.connection.connection!.sendCustomRequest(FetchReposRequestType.method, {});
	}

	fetchUnreads(): Promise<GetUnreadsResponse> {
		return this.connection.connection!.sendCustomRequest(GetUnreadsRequestType.method, {});
	}

	fetchPreferences(): Promise<GetPreferencesResponse> {
		return this.connection.connection!.sendCustomRequest(
			GetPreferencesRequestType.method,
			undefined
		);
	}

	dispose() {
		this.connection.stop();
	}
}
