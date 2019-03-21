import { CompositeDisposable, Disposable, Emitter } from "atom";
import { Convert, LanguageClientConnection } from "atom-languageclient";
import {
	createMessageConnection,
	IPCMessageReader,
	IPCMessageWriter,
} from "atom-languageclient/node_modules/vscode-jsonrpc";
import { ChildProcess, spawn } from "child_process";
import * as fs from "fs";
import {
	ClientCapabilities,
	LogMessageParams,
	NotificationType,
	RequestType,
} from "vscode-languageserver-protocol";
import {
	AccessToken,
	AgentInitializeResult,
	AgentOptions,
	AgentResult,
	DidChangeDataNotification,
	DidChangeDataNotificationType,
	DidChangeDocumentMarkersNotification,
	DidChangeDocumentMarkersNotificationType,
	TraceLevel,
} from "../protocols/agent/agent.protocol";
import { asAbsolutePath, Editor, getAgentSource, getPluginVersion } from "../utils";

type RequestOrNotificationType<P, R> = RequestType<P, R, any, any> | NotificationType<P, R>;

type RequestOf<RT> = RT extends RequestOrNotificationType<infer RQ, any> ? RQ : never;
type ResponseOf<RT> = RT extends RequestOrNotificationType<any, infer R> ? R : never;

const capabilities: ClientCapabilities = {
	workspace: {
		applyEdit: true,
		configuration: false,
		workspaceEdit: {
			documentChanges: true,
		},
		workspaceFolders: true,
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

abstract class AgentConnection {
	private _connection: LanguageClientConnection | undefined;
	private _agentProcess: ChildProcess | undefined;

	get connection() {
		return this._connection;
	}

	protected abstract preInitialization(connection: LanguageClientConnection);

	protected abstract onPrematureExit();

	protected async start(initOptions: {
		serverUrl: string;
		email?: string;
		teamId?: string;
		team?: string;
		passwordOrToken?: string | AccessToken;
		signupToken?: string;
	}) {
		this._agentProcess = await this.startServer();

		const rpc = createMessageConnection(
			new IPCMessageReader(this._agentProcess as ChildProcess),
			new IPCMessageWriter(this._agentProcess as ChildProcess)
		);

		this._connection = new LanguageClientConnection(rpc);

		rpc.onRequest("workspace/workspaceFolders", () => {
			return atom.project
				.getDirectories()
				.map(dir => ({ uri: Convert.pathToUri(dir.getPath()), name: dir.getBaseName() }));
		});

		this.preInitialization(this._connection);

		const initializationOptions: Partial<AgentOptions> = {
			extension: {
				build: "",
				buildEnv: "dev",
				version: getPluginVersion(),
				versionFormatted: `${getPluginVersion()} (dev)`,
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

		this._connection.initialized();

		return (response as AgentInitializeResult).result;
	}

	private startServer(): ChildProcess {
		const options: { [k: string]: any } = {};
		options.env = Object.create(process.env);
		options.env.ELECTRON_RUN_AS_NODE = "1";
		options.env.ELECTRON_NO_ATTACH_CONSOLE = "1";
		options.stdio = [null, null, null, "ipc"];

		const agentPath = atom.inDevMode() ? getAgentSource() : asAbsolutePath("dist/agent.js");
		const agentProcess = spawn(
			process.execPath,
			["--nolazy", "--inspect=6011", agentPath, "--node-ipc"],
			options
		);

		agentProcess.on("error", error => {
			console.error(error);
		});
		agentProcess.on("disconnect", () => {
			if (this._connection) {
				console.error("CodeStream agent process connection disconnected prematurely");
				this.onPrematureExit();
				// this.stop();
			}
		});
		agentProcess.on("exit", code => {
			if (Number(code) !== 0) {
				console.error(`CodeStream agent process exited with non-zero exit code ${code}`);
			}
		});

		return agentProcess;
	}

	protected async stop() {
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

const INITIALIZED = "initialized";
const DATA_CHANGED = "data-changed";
const TERMINATED = "terminated";

export class CodeStreamAgent extends AgentConnection implements Disposable {
	private emitter = new Emitter();
	private subscriptions = new CompositeDisposable();

	async init(
		email: string,
		passwordOrToken: string | AccessToken,
		serverUrl: string,
		teamOption: { teamId?: string; team?: string } = {}
	): Promise<AgentResult> {
		const result = await this.start({
			email,
			passwordOrToken,
			serverUrl,
			...teamOption,
		});

		if (result.error) throw result.error;

		this.emitter.emit(INITIALIZED);
		return result;
	}

	async initWithSignupToken(
		token: string,
		serverUrl: string,
		teamOption: { teamId?: string; team?: string } = {}
	): Promise<AgentResult> {
		const result = await this.start({ signupToken: token, serverUrl, ...teamOption });
		if (result.error) {
			throw result.error;
		}

		this.emitter.emit(INITIALIZED);

		return result;
	}

	protected preInitialization(connection: LanguageClientConnection) {
		this.subscriptions.add(
			atom.workspace.observeTextEditors(editor => {
				const filePath = editor.getPath;
				if (!filePath) return;

				connection.didOpenTextDocument({
					textDocument: {
						uri: Editor.getUri(editor),
						languageId: "",
						version: editor.getBuffer().createCheckpoint(),
						text: editor.getText(),
					},
				});
				this.subscriptions.add(
					editor.onDidDestroy(() =>
						connection.didCloseTextDocument({ textDocument: { uri: Editor.getUri(editor) } })
					),
					editor.onDidChange(() => {
						connection.didChangeTextDocument({
							textDocument: {
								uri: Editor.getUri(editor),
								version: editor.createCheckpoint(),
							},
							contentChanges: [{ text: editor.getText() }],
						});
					})
				);
			})
		);

		fs.unlink(asAbsolutePath("agent.log"), error => {
			if (error && !error.message.includes("no such file or directory")) {
				console.error("CodeStream: error removing agent.log", error);
			}
		});

		connection.onLogMessage(this.onLogMessage);
		connection.onCustom(DidChangeDataNotificationType.method, event => {
			this.emitter.emit(DATA_CHANGED, event);
		});
		connection.onCustom(DidChangeDocumentMarkersNotificationType.method, notification => {
			this.emitter.emit(DidChangeDocumentMarkersNotificationType.method, notification);
		});
	}

	protected onPrematureExit() {
		this.emitter.emit(TERMINATED);
		this.dispose();
	}

	private onLogMessage = (params: LogMessageParams) => {
		fs.appendFile(asAbsolutePath("agent.log"), `${params.message}\n`, error => {
			if (error) console.error("CodeStream: failed to write to agent.log", error);
		});
	}

	onInitialized(cb: () => void): Disposable {
		return this.emitter.on(INITIALIZED, cb);
	}

	// TODO: reset workspace-session
	onTerminated(cb: () => void): Disposable {
		return this.emitter.on(TERMINATED, cb);
	}

	onDidChangeData(cb: (event: DidChangeDataNotification) => void) {
		return this.emitter.on(DATA_CHANGED, cb);
	}

	onDidChangeDocumentMarkers(cb: (event: DidChangeDocumentMarkersNotification) => void) {
		return this.emitter.on(DidChangeDocumentMarkersNotificationType.method, cb);
	}

	request<RT extends RequestType<any, any, any, any>>(
		requestType: RT,
		params: RequestOf<RT>
	): Promise<ResponseOf<RT>> {
		return this.connection!.sendCustomRequest(requestType.method, params);
	}

	sendRequest<R>(name: string, params?: any): Promise<R> {
		return this.connection!.sendCustomRequest(name, params);
	}

	dispose() {
		this.emitter.dispose();
		this.subscriptions.dispose();
		this.stop();
	}
}
