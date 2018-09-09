import { ChildProcess, spawn } from "child_process";
import { Convert, LanguageClientConnection } from "atom-languageclient";
import * as rpc from "vscode-jsonrpc";
import { getPath } from "../network-request";
import { asAbsolutePath, getPluginVersion } from "../utils";
import { AgentOptions } from "../shared/agent.protocol";

const capabilities = {
	workspace: {
		applyEdit: true,
		workspaceEdit: {
			documentChanges: true
		},
		didChangeConfiguration: {
			dynamicRegistration: false
		},
		didChangeWatchedFiles: {
			dynamicRegistration: false
		},
		symbol: {
			dynamicRegistration: false
		},
		executeCommand: {
			dynamicRegistration: false
		}
	},
	textDocument: {
		synchronization: {
			dynamicRegistration: false,
			willSave: true,
			willSaveWaitUntil: true,
			didSave: true
		},
		completion: {
			dynamicRegistration: false,
			completionItem: {
				snippetSupport: true,
				commitCharactersSupport: false
			},
			contextSupport: true
		},
		hover: {
			dynamicRegistration: false
		},
		signatureHelp: {
			dynamicRegistration: false
		},
		references: {
			dynamicRegistration: false
		},
		documentHighlight: {
			dynamicRegistration: false
		},
		documentSymbol: {
			dynamicRegistration: false
		},
		formatting: {
			dynamicRegistration: false
		},
		rangeFormatting: {
			dynamicRegistration: false
		},
		onTypeFormatting: {
			dynamicRegistration: false
		},
		definition: {
			dynamicRegistration: false
		},
		codeAction: {
			dynamicRegistration: false
		},
		codeLens: {
			dynamicRegistration: false
		},
		documentLink: {
			dynamicRegistration: false
		},
		rename: {
			dynamicRegistration: false
		}
	},
	experimental: {}
};

class AgentConnection {
	private _connection: LanguageClientConnection | undefined;
	private _agentProcess: ChildProcess | undefined;

	get connection() {
		return this._connection;
	}

	async start(initOptions: { email: string; passwordOrToken: string }) {
		this._agentProcess = await this.startServer();
		this._connection = new LanguageClientConnection(
			rpc.createMessageConnection(
				new rpc.IPCMessageReader(this._agentProcess),
				new rpc.IPCMessageWriter(this._agentProcess)
			)
		);

		const initializationOptions = {
			extensionBuild: "",
			extensionVersion: getPluginVersion(),
			gitPath: "git",
			ideVersion: atom.getVersion(),
			serverUrl: getPath(),
			...initOptions
		} as AgentOptions;

		const response = await this._connection.initialize({
			processId: this._agentProcess.pid,
			capabilities,
			rootUri: Convert.pathToUri(atom.project.getPaths()[0]), // TODO: what if there are no projects
			initializationOptions
		});

		if (response.result.error) {
			this.stop();
		}
		return response.result;
	}

	private startServer(): ChildProcess {
		const options: { [k: string]: any } = {};
		options.env = Object.create(process.env);
		options.env.ELECTRON_RUN_AS_NODE = "1";
		options.env.ELECTRON_NO_ATTACH_CONSOLE = "1";
		options.stdio = [null, null, null, "ipc"];

		const agentProcess = spawn(
			process.execPath,
			[asAbsolutePath("dist/agent.js"), "--node-ipc"],
			options
		);
		// agentProcess.on("disconnect", () => {
		// 	console.error("disconnected");
		// });
		// agentProcess.on("exit", code => {
		// 	console.error("exited", code);
		// });
		agentProcess.on("message", message => {
			console.debug("message", message);
		});
		return agentProcess;
	}

	private stop() {
		if (this._connection) {
			this._connection.shutdown();
			this._connection.dispose();
			this._connection.exit();
			this._connection = undefined;
		}
		if (this._agentProcess) {
			this._agentProcess.kill();
			this._agentProcess = undefined;
		}
	}
}

export default class CodeStreamAgent {
	private _connection: AgentConnection;

	constructor() {
		this._connection = new AgentConnection();
	}

	async login(email: string, password: string) {
		const result = await this._connection.start({
			email,
			passwordOrToken: password
		});
		console.debug("attempted to login", result);
	}
}
