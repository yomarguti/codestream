import { ChildProcess, spawn } from "child_process";
import {
	AgentInitializeResult,
	BaseAgentOptions,
	DidChangeApiVersionCompatibilityNotification,
	DidChangeApiVersionCompatibilityNotificationType,
	DidChangeConnectionStatusNotification,
	DidChangeConnectionStatusNotificationType,
	DidChangeDataNotification,
	DidChangeDataNotificationType,
	DidChangeDocumentMarkersNotification,
	DidChangeDocumentMarkersNotificationType,
	DidChangeVersionCompatibilityNotification,
	DidChangeVersionCompatibilityNotificationType,
	DidEncounterMaintenanceModeNotification,
	DidEncounterMaintenanceModeNotificationType,
	DidFailLoginNotificationType,
	DidLoginNotification,
	DidLoginNotificationType,
	DidStartLoginNotificationType,
	RestartRequiredNotificationType,
	TelemetryRequest,
	TelemetryRequestType
} from "@codestream/protocols/agent";
import { CompositeDisposable, Disposable } from "atom";
import { Convert, LanguageClientConnection } from "atom-languageclient";
import { EnvironmentConfig } from "env-utils";
import { FileLogger } from "logger";
import { asAbsolutePath, Debug, Echo, Editor, getAgentSource, getPluginVersion } from "utils";
import {
	createMessageConnection,
	IPCMessageReader,
	IPCMessageWriter,
	MessageConnection,
	NotificationType,
	RequestType
} from "vscode-jsonrpc";
import {
	ConfigurationParams,
	DidChangeWorkspaceFoldersNotification,
	DidChangeWorkspaceFoldersParams,
	MessageType,
	RegistrationParams,
	WorkspaceFoldersChangeEvent
} from "vscode-languageserver-protocol";
import { Container } from "workspace/container";
import { LSP_CLIENT_CAPABILITIES } from "./lsp-client-capabilities";

/*
	Create a reverse mapping of the MessageType enum so that given an integer, we know the type.
	The result will be something like { 0: 'log', 1: 'error' }
*/
const reverseMessageType = function() {
	const result = {};
	Object.entries(MessageType).forEach(([type, int]) => {
		result[int] = type.toLowerCase();
	});
	return result;
};

const ReversedMessageType = reverseMessageType();

type RequestOrNotificationType<P, R> = RequestType<P, R, any, any> | NotificationType<P, R>;

export type RequestOf<RT> = RT extends RequestOrNotificationType<infer RQ, any> ? RQ : never;
export type ResponseOf<RT> = RT extends RequestOrNotificationType<any, infer R> ? R : never;

const normalizeProxyUrl = (url: string) => {
	const protocol = "http://";
	if (!url.startsWith(protocol)) {
		return `${protocol}${url}`;
	}
	return url;
};

export class AgentConnection implements Disposable {
	private _connection: LanguageClientConnection | undefined;
	private _agentProcess: ChildProcess | undefined;
	private _initializedEvent = new Echo();
	private _crashEmitter = new Echo();
	private _didChangeDataEvent = new Echo<DidChangeDataNotification>();
	private _didChangeDocumentMarkersEvent = new Echo<DidChangeDocumentMarkersNotification>();
	private _didChangeConnectionStatusEvent = new Echo<DidChangeConnectionStatusNotification>();
	private _didStartLoginEvent = new Echo();
	private _didFailLoginEvent = new Echo();
	private _didLoginEvent = new Echo<DidLoginNotification>();
	private _didChangeVersionCompatibility = new Echo<DidChangeVersionCompatibilityNotification>();
	private _didChangeApiVersionCompatibility = new Echo<
		DidChangeApiVersionCompatibilityNotification
	>();
	private _didEncounterMaintenanceMode = new Echo<DidEncounterMaintenanceModeNotification>();
	private _restartNeededEmitter = new Echo();
	private _initialized = false;
	private _subscriptions = new CompositeDisposable();
	private logger = new FileLogger("agent");

	get initialized() {
		return this._initialized;
	}

	get connection() {
		return this._connection;
	}

	constructor(private _environment: EnvironmentConfig) {}

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

	@started
	telemetry(data: TelemetryRequest) {
		this.request(TelemetryRequestType, data);
	}

	onDidInitialize(cb: () => void) {
		return this._initializedEvent.add(cb);
	}

	onDidStartLogin(cb: () => void) {
		return this._didStartLoginEvent.add(cb);
	}

	onDidFailLogin(cb: () => void) {
		return this._didFailLoginEvent.add(cb);
	}

	onDidLogin(cb: (event: DidLoginNotification) => void) {
		return this._didLoginEvent.add(cb);
	}

	onDidChangeData(cb: (event: DidChangeDataNotification) => void) {
		return this._didChangeDataEvent.add(cb);
	}

	onDidChangeDocumentMarkers(cb: (event: DidChangeDocumentMarkersNotification) => void) {
		return this._didChangeDocumentMarkersEvent.add(cb);
	}

	onDidChangeConnectionStatus(cb: (event: DidChangeConnectionStatusNotification) => void) {
		return this._didChangeConnectionStatusEvent.add(cb);
	}

	onDidChangeVersionCompatibility(cb: (event: DidChangeVersionCompatibilityNotification) => void) {
		return this._didChangeVersionCompatibility.add(cb);
	}

	onDidChangeApiVersionCompatibility(
		cb: (event: DidChangeApiVersionCompatibilityNotification) => void
	) {
		return this._didChangeApiVersionCompatibility.add(cb);
	}

	onDidEncounterMaintenanceMode(cb: (event: DidEncounterMaintenanceModeNotification) => void) {
		return this._didEncounterMaintenanceMode.add(cb);
	}

	onDidCrash(cb: () => void) {
		return this._crashEmitter.add(cb);
	}

	onDidRequireRestart(cb: () => void) {
		return this._restartNeededEmitter.add(cb);
	}

	dispose() {
		this.stop();
		this.logger.dispose();
		this._initializedEvent.dispose();
		this._crashEmitter.dispose();
		this._didLoginEvent.dispose();
		this._didChangeDataEvent.dispose();
		this._didChangeDocumentMarkersEvent.dispose();
		this._didChangeConnectionStatusEvent.dispose();
		this._didStartLoginEvent.dispose();
		this._didFailLoginEvent.dispose();
		this._didLoginEvent.dispose();
	}

	async start() {
		this._agentProcess = this._startServer();

		const rpc = createMessageConnection(
			new IPCMessageReader(this._agentProcess as ChildProcess),
			new IPCMessageWriter(this._agentProcess as ChildProcess)
		);

		this._connection = new LanguageClientConnection(rpc);

		this._connection.onCustom(RestartRequiredNotificationType.method, () => {
			this._restartNeededEmitter.push();
		});
		this._preInitialization(this._connection, rpc);

		const firstProject = atom.project.getPaths()[0]; // TODO: what if there are no projects

		const response = await this._connection.initialize({
			processId: this._agentProcess.pid,
			workspaceFolders: [],
			rootUri: firstProject ? Convert.pathToUri(firstProject) : null,
			capabilities: LSP_CLIENT_CAPABILITIES,
			initializationOptions: this._getInitializationOptions()
		});

		if (response.result.error) {
			this.stop();
		} else {
			this._connection.initialized();
			this._initialized = true;
			this._initializedEvent.push();
		}

		return (response as AgentInitializeResult).result;
	}

	private _getInitializationOptions(): BaseAgentOptions {
		const initializationOptions: Partial<BaseAgentOptions> = {
			extension: {
				build: "",
				buildEnv: "dev",
				version: getPluginVersion(),
				versionFormatted: `${getPluginVersion()}${atom.inDevMode() ? "(dev)" : ""}`
			},
			ide: {
				name: "Atom",
				version: atom.getVersion()
			},
			disableStrictSSL: Container.configs.get("disableStrictSSL"),
			isDebugging: atom.inDevMode(),
			traceLevel: Container.configs.get("traceLevel"),
			gitPath: "git",
			serverUrl: this._environment.serverUrl
		};

		const configs = Container.configs;
		const proxySupport = configs.get("proxySupport");

		if (proxySupport === "on") {
			const proxy = configs.get("proxyUrl");
			if (proxy !== "") {
				initializationOptions.proxySupport = "override";
				initializationOptions.proxy = {
					url: normalizeProxyUrl(proxy),
					strictSSL: configs.get("proxyStrictSSL")
				};
			} else {
				initializationOptions.proxySupport = "on";
			}
		} else {
			initializationOptions.proxySupport = proxySupport;
		}

		return initializationOptions as BaseAgentOptions;
	}

	private _preInitialization(connection: LanguageClientConnection, rpc: MessageConnection) {
		rpc.onRequest("client/registerCapability", (params: RegistrationParams) => {
			params.registrations.forEach(registration => {
				// TODO: register workspace/didChangeConfiguration
				if (registration.method === DidChangeWorkspaceFoldersNotification.type.method) {
					this._subscriptions.add(
						atom.project.onDidChangePaths(() => {
							connection.sendCustomNotification(DidChangeWorkspaceFoldersNotification.type.method, {
								event: {
									added: atom.project.getDirectories().map(dir => ({
										uri: Convert.pathToUri(dir.getPath()),
										name: dir.getBaseName()
									})),
									removed: []
								} as WorkspaceFoldersChangeEvent
							} as DidChangeWorkspaceFoldersParams);
						})
					);
				}
			});
		});

		rpc.onRequest("workspace/configuration", (params: ConfigurationParams) =>
			params.items.map(({ section }) => {
				const result = {};
				if (section === "files.exclude" || section === "search.exclude") {
					const ignoredPaths = atom.config.get("core.ignoredNames") as string[];
					for (const path of ignoredPaths) {
						result[path] = true;
					}
					return result;
				}
			})
		);

		rpc.onRequest("workspace/workspaceFolders", () =>
			atom.project
				.getDirectories()
				.map(dir => ({ uri: Convert.pathToUri(dir.getPath()), name: dir.getBaseName() }))
		);

		this._subscriptions.add(
			atom.workspace.observeTextEditors(editor => {
				const filePath = editor.getPath();
				if (!filePath) return;

				connection.didOpenTextDocument({
					textDocument: {
						uri: Editor.getUri(editor),
						languageId: "",
						version: editor.getBuffer().createCheckpoint(),
						text: editor.getText()
					}
				});
				this._subscriptions.add(
					editor.onDidDestroy(() =>
						connection.didCloseTextDocument({ textDocument: { uri: Editor.getUri(editor) } })
					),
					editor.onDidChange(() => {
						connection.didChangeTextDocument({
							textDocument: {
								uri: Editor.getUri(editor),
								version: editor.createCheckpoint()
							},
							contentChanges: [{ text: editor.getText() }]
						});
					}),
					editor.onDidChangePath(path => {
						connection.didCloseTextDocument({ textDocument: { uri: Convert.pathToUri(filePath) } });
						connection.didOpenTextDocument({
							textDocument: {
								uri: Convert.pathToUri(path),
								languageId: "",
								version: editor.getBuffer().createCheckpoint(),
								text: editor.getText()
							}
						});
					})
				);
			})
		);

		connection.onLogMessage(params => {
			this.logger.log(ReversedMessageType[params.type], params.message);
		});
		connection.onCustom(DidChangeDataNotificationType.method, event => {
			this._didChangeDataEvent.push(event as DidChangeDataNotification);
		});
		connection.onCustom(DidChangeDocumentMarkersNotificationType.method, notification => {
			this._didChangeDocumentMarkersEvent.push(
				notification as DidChangeDocumentMarkersNotification
			);
		});
		connection.onCustom(DidChangeConnectionStatusNotificationType.method, notification =>
			this._didChangeConnectionStatusEvent.push(
				notification as DidChangeConnectionStatusNotification
			)
		);
		connection.onCustom(DidStartLoginNotificationType.method, () =>
			this._didStartLoginEvent.push()
		);
		connection.onCustom(DidFailLoginNotificationType.method, () => this._didFailLoginEvent.push());
		connection.onCustom(DidLoginNotificationType.method, notification =>
			this._didLoginEvent.push(notification as DidLoginNotification)
		);
		connection.onCustom(DidChangeVersionCompatibilityNotificationType.method, notification =>
			this._didChangeVersionCompatibility.push(
				notification as DidChangeVersionCompatibilityNotification
			)
		);
		connection.onCustom(DidChangeApiVersionCompatibilityNotificationType.method, notification =>
			this._didChangeApiVersionCompatibility.push(
				notification as DidChangeApiVersionCompatibilityNotification
			)
		);
		connection.onCustom(DidEncounterMaintenanceModeNotificationType.method, notification =>
			this._didEncounterMaintenanceMode.push(
				notification as DidEncounterMaintenanceModeNotification
			)
		);
	}

	private _getAgentSourceArgs(): string[] {
		if (Debug.isDebugging()) {
			return ["--inspect=6012", getAgentSource()];
		}
		return [asAbsolutePath("dist/agent/agent.js")];
	}

	private _startServer(): ChildProcess {
		const options: { [k: string]: any } = {};
		options.env = Object.create(process.env);
		options.env.ELECTRON_RUN_AS_NODE = "1";
		options.env.ELECTRON_NO_ATTACH_CONSOLE = "1";
		options.stdio = [null, null, null, "ipc"];

		const agentProcess = spawn(
			process.execPath,
			["--no-lazy", ...this._getAgentSourceArgs(), "--node-ipc"],
			options
		);

		if (Debug.isDebugging()) {
			console.debug("CodeStream agent pid", agentProcess.pid);
		}

		agentProcess.on("error", error => {
			console.error(error);
		});
		/* I'm not sure handling `disconnect` is necessary - akonwi */
		// agentProcess.on("disconnect", () => {
		// 	// this._connection will be unset if this instance was stopped properly
		// 	if (this._connection) {
		// 		atom.notifications.addWarning("The CodeStream agent process unexpectedly crashed.", {
		// 			description: "Please open the dev tools and share the error with us.",
		// 		});
		// 		this._crashEmitter.push();
		// 	}
		// 	this.stop();
		// });
		agentProcess.on("exit", code => {
			if (Number(code) !== 0) {
				if (code === 12) {
					atom.notifications.addError("Port 6012 for debugging is already in use");
				} else console.error(`CodeStream agent process exited with non-zero exit code ${code}`);
			}
			this.stop();
		});

		return agentProcess;
	}

	stop() {
		if (!this.initialized) return;

		try {
			this._connection!.dispose();
		} catch (error) {
			this.logger.log("error", `Error disposing LanguageClientConnection - ${error}`);
		} finally {
			this._connection = undefined;
		}

		try {
			this._agentProcess!.kill();
		} catch (error) {
			this.logger.log("error", `Error killing agent process - ${error}`);
		} finally {
			this._agentProcess = undefined;
		}

		this._subscriptions.dispose();
		this._subscriptions = new CompositeDisposable();
		this._initialized = false;
	}

	async reset(newEnvironmentConfig?: EnvironmentConfig) {
		if (newEnvironmentConfig != null) this._environment = newEnvironmentConfig;
		this.stop();
		await this.start();
	}
}

function started(_target: AgentConnection, _key: string, descriptor: PropertyDescriptor) {
	const fn = descriptor.value;

	descriptor.value = async function(this: AgentConnection, ...args: any[]) {
		if (!this.initialized) {
			await this.start();
		}
		return fn.apply(this, args);
	};

	return descriptor;
}
