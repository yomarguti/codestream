import { CompositeDisposable, Disposable, Emitter } from "atom";
import { Convert, LanguageClientConnection } from "atom-languageclient";
import {
	createMessageConnection,
	IPCMessageReader,
	IPCMessageWriter,
	MessageConnection,
} from "atom-languageclient/node_modules/vscode-jsonrpc";
import { ChildProcess, spawn } from "child_process";
import { EnvironmentConfig } from "env-utils";
import { FileLogger } from "logger";
import {
	ConfigurationParams,
	DidChangeWorkspaceFoldersNotification,
	DidChangeWorkspaceFoldersParams,
	LogMessageParams,
	MessageType,
	NotificationType,
	RegistrationParams,
	RequestType,
	WorkspaceFoldersChangeEvent,
} from "vscode-languageserver-protocol";
import {
	AgentInitializeResult,
	BaseAgentOptions,
	DidChangeConnectionStatusNotification,
	DidChangeConnectionStatusNotificationType,
	DidChangeDataNotification,
	DidChangeDataNotificationType,
	DidChangeDocumentMarkersNotification,
	DidChangeDocumentMarkersNotificationType,
	DidFailLoginNotificationType,
	DidLoginNotification,
	DidLoginNotificationType,
	DidStartLoginNotificationType,
	TelemetryRequest,
	TelemetryRequestType,
} from "../protocols/agent/agent.protocol";
import { asAbsolutePath, Debug, Echo, Editor, getAgentSource, getPluginVersion } from "../utils";
import { capabilities } from "./client-capabilities";
import { Container } from "./container";

type RequestOrNotificationType<P, R> = RequestType<P, R, any, any> | NotificationType<P, R>;

export type RequestOf<RT> = RT extends RequestOrNotificationType<infer RQ, any> ? RQ : never;
type ResponseOf<RT> = RT extends RequestOrNotificationType<any, infer R> ? R : never;

const reverseMessageType = function() {
	const result = {};
	Object.entries(MessageType).forEach(([type, int]) => {
		result[int] = type.toLowerCase();
	});
	return result;
};

const ReversedMessageType = reverseMessageType();

abstract class AgentConnection {
	private _connection: LanguageClientConnection | undefined;
	private _agentProcess: ChildProcess | undefined;
	private _initializedEvent = new Echo();
	private _crashEmitter = new Echo();
	private _initialized = false;

	get initialized() {
		return this._initialized;
	}

	get connection() {
		return this._connection;
	}

	onDidInitialize(cb: () => void) {
		return this._initializedEvent.add(cb);
	}

	onDidCrash(cb: () => void) {
		return this._crashEmitter.add(cb);
	}

	protected abstract preInitialization(
		connection: LanguageClientConnection,
		rpc: MessageConnection
	): void;

	protected getInitializationOptions(): Partial<BaseAgentOptions> {
		return {};
	}

	async start() {
		this._agentProcess = await this.startServer();

		const rpc = createMessageConnection(
			new IPCMessageReader(this._agentProcess as ChildProcess),
			new IPCMessageWriter(this._agentProcess as ChildProcess)
		);

		this._connection = new LanguageClientConnection(rpc);

		this.preInitialization(this._connection, rpc);

		const initializationOptions: Partial<BaseAgentOptions> = {
			extension: {
				build: "",
				buildEnv: "dev",
				version: getPluginVersion(),
				versionFormatted: `${getPluginVersion()}${atom.inDevMode() ? "(dev)" : ""}`,
			},
			ide: {
				name: "Atom",
				version: atom.getVersion(),
			},
			isDebugging: atom.inDevMode(),
			traceLevel: Container.configs.get("traceLevel"),
			gitPath: "git",
			...this.getInitializationOptions(),
		};

		const configs = Container.configs;
		const proxySupport = configs.get("proxySupport");

		if (proxySupport === "override") {
			const proxy = configs.get("proxyUrl");
			if (proxy !== "") {
				initializationOptions.proxy = {
					url: proxy,
					strictSSL: configs.get("proxyStrictSSL"),
				};
				initializationOptions.proxySupport = "override";
			} else {
				atom.notifications.addWarning("CodeStream: Invalid Proxy Settings", {
					dismissable: true,
					detail: "We'll attempt to detect proxy settings from the shell environment.",
					description: "Proxy Support set to `override` but a Proxy Url was not provided.",
				});
				initializationOptions.proxySupport = "on";
			}
		} else {
			initializationOptions.proxySupport = proxySupport;
		}

		const firstProject = atom.project.getPaths()[0]; // TODO: what if there are no projects
		const response = await this._connection.initialize({
			processId: this._agentProcess.pid,
			workspaceFolders: [],
			rootUri: firstProject ? Convert.pathToUri(firstProject) : null,
			capabilities,
			initializationOptions,
		});

		if (response.result.error) {
			await this.stop();
		} else {
			this._connection.initialized();
			this._initialized = true;
			this._initializedEvent.push();
		}

		return (response as AgentInitializeResult).result;
	}

	private buildSpawnArgs(): [string, string[]] {
		if (Debug.isDebugging()) {
			return [
				"/usr/local/bin/node",
				["--no-lazy", "--inspect=6012", getAgentSource(), "--node-ipc"],
			];
		}
		return [process.execPath, ["--no-lazy", asAbsolutePath("dist/agent/agent.js"), "--node-ipc"]];
	}

	private startServer(): ChildProcess {
		const options: { [k: string]: any } = {};
		options.env = Object.create(process.env);
		options.env.ELECTRON_RUN_AS_NODE = "1";
		options.env.ELECTRON_NO_ATTACH_CONSOLE = "1";
		options.stdio = [null, null, null, "ipc"];

		const [nodePath, args] = this.buildSpawnArgs();

		const agentProcess = spawn(nodePath, args, options);

		if (Debug.isDebugging()) {
			console.debug("CodeStream agent pid", agentProcess.pid);
			console.debug("spawned with", nodePath, args);
		}

		agentProcess.on("error", error => {
			console.error(error);
		});
		agentProcess.on("disconnect", () => {
			if (this._connection && this._connection.isConnected) {
				atom.notifications.addWarning("The CodeStream agent process unexpectedly crashed.", {
					description: "Please open the dev tools and share the error with us.",
				});
				this._crashEmitter.push();
			}
			this.stop();
		});
		agentProcess.on("exit", code => {
			if (Number(code) !== 0) {
				console.error(`CodeStream agent process exited with non-zero exit code ${code}`);
			}
			this.stop();
		});

		return agentProcess;
	}

	protected async stop() {
		this._connection!.dispose();
		this._agentProcess!.kill();
		this._crashEmitter.dispose();
	}
}

const DATA_CHANGED = "data-changed";

export class CodeStreamAgent extends AgentConnection implements Disposable {
	private emitter = new Emitter();
	private subscriptions = new CompositeDisposable();
	private logger = new FileLogger("agent");
	private disposed = false;
	get isDisposed() {
		return this.disposed;
	}

	constructor(private environment: EnvironmentConfig) {
		super();
	}

	protected getInitializationOptions() {
		return { serverUrl: this.environment.serverUrl };
	}

	protected preInitialization(connection: LanguageClientConnection, rpc: MessageConnection) {
		rpc.onRequest("client/registerCapability", (params: RegistrationParams) => {
			params.registrations.forEach(registration => {
				// TODO: register workspace/didChangeConfiguration
				if (registration.method === DidChangeWorkspaceFoldersNotification.type.method) {
					this.subscriptions.add(
						atom.project.onDidChangePaths(() => {
							connection.sendCustomNotification(DidChangeWorkspaceFoldersNotification.type.method, {
								event: {
									added: atom.project.getDirectories().map(dir => ({
										uri: Convert.pathToUri(dir.getPath()),
										name: dir.getBaseName(),
									})),
									removed: [],
								} as WorkspaceFoldersChangeEvent,
							} as DidChangeWorkspaceFoldersParams);
						})
					);
				}
			});
		});

		rpc.onRequest("workspace/configuration", (params: ConfigurationParams) => {
			return params.items.map(({ section }) => {
				const result = {};
				if (section === "files.exclude" || section === "search.exclude") {
					const ignoredPaths = atom.config.get("core.ignoredNames") as string[];
					for (const path of ignoredPaths) {
						result[path] = true;
					}
					return result;
				}
			});
		});

		rpc.onRequest("workspace/workspaceFolders", () => {
			return atom.project
				.getDirectories()
				.map(dir => ({ uri: Convert.pathToUri(dir.getPath()), name: dir.getBaseName() }));
		});

		this.subscriptions.add(
			atom.workspace.observeTextEditors(editor => {
				const filePath = editor.getPath();
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
					}),
					editor.onDidChangePath(path => {
						connection.didCloseTextDocument({ textDocument: { uri: Convert.pathToUri(filePath) } });
						connection.didOpenTextDocument({
							textDocument: {
								uri: Convert.pathToUri(path),
								languageId: "",
								version: editor.getBuffer().createCheckpoint(),
								text: editor.getText(),
							},
						});
					})
				);
			})
		);

		connection.onLogMessage(this.onLogMessage);
		connection.onCustom(DidChangeDataNotificationType.method, event => {
			this.emitter.emit(DATA_CHANGED, event);
		});
		connection.onCustom(DidChangeDocumentMarkersNotificationType.method, notification => {
			this.emitter.emit(DidChangeDocumentMarkersNotificationType.method, notification);
		});
		connection.onCustom(DidChangeConnectionStatusNotificationType.method, notification =>
			this.emitter.emit(DidChangeConnectionStatusNotificationType.method, notification)
		);
		connection.onCustom(DidStartLoginNotificationType.method, notification =>
			this.emitter.emit(DidStartLoginNotificationType.method, notification)
		);
		connection.onCustom(DidFailLoginNotificationType.method, notification =>
			this.emitter.emit(DidFailLoginNotificationType.method, notification)
		);
		connection.onCustom(DidLoginNotificationType.method, notification =>
			this.emitter.emit(DidLoginNotificationType.method, notification)
		);
	}

	private onLogMessage = (params: LogMessageParams) => {
		this.logger.log(ReversedMessageType[params.type], params.message);
	}

	onDidStartLogin(cb: () => void) {
		return this.emitter.on(DidStartLoginNotificationType.method, cb);
	}

	onDidFailLogin(cb: () => void) {
		return this.emitter.on(DidFailLoginNotificationType.method, cb);
	}

	onDidLogin(cb: (event: DidLoginNotification) => void) {
		return this.emitter.on(DidLoginNotificationType.method, cb);
	}

	onDidChangeData(cb: (event: DidChangeDataNotification) => void) {
		return this.emitter.on(DATA_CHANGED, cb);
	}

	onDidChangeDocumentMarkers(cb: (event: DidChangeDocumentMarkersNotification) => void) {
		return this.emitter.on(DidChangeDocumentMarkersNotificationType.method, cb);
	}

	onDidChangeConnectionStatus(cb: (event: DidChangeConnectionStatusNotification) => void) {
		return this.emitter.on(DidChangeConnectionStatusNotificationType.method, cb);
	}

	@started
	telemetry(data: TelemetryRequest) {
		this.request(TelemetryRequestType, data);
	}

	@started
	request<RT extends RequestType<any, any, any, any>>(
		requestType: RT,
		params: RequestOf<RT>
	): Promise<ResponseOf<RT>> {
		return this.connection!.sendCustomRequest(requestType.method, params);
	}

	// for when typing can't be inferred
	@started
	sendRequest<R>(name: string, params?: any): Promise<R> {
		return this.connection!.sendCustomRequest(name, params);
	}

	dispose() {
		this.disposed = true;
		this.logger.dispose();
		this.emitter.dispose();
		this.subscriptions.dispose();
		this.stop();
	}
}

function started(target: CodeStreamAgent, key: string, descriptor: PropertyDescriptor) {
	const fn = descriptor.value;

	descriptor.value = async function(this: CodeStreamAgent, ...args: any[]) {
		if (!this.initialized) {
			await this.start();
		}
		return fn.apply(this, args);
	};

	return descriptor;
}
