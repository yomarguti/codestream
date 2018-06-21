"use strict";
import "reflect-metadata";

import { ExtensionContext, extensions, version as vscodeVersion } from "vscode";
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from "vscode-languageclient";
import { ContextKeys, setContext } from "./common";
import { Config, configuration, Configuration } from "./configuration";
import { extensionQualifiedId } from "./constants";
import { Container } from "./container";
import { Logger } from "./logger";
import { SessionStatusChangedEvent } from "./api/session";
import { getRepositories, GitApiRepository, gitPath } from "./git/git";

const extension = extensions.getExtension(extensionQualifiedId)!;
export const extensionVersion = extension.packageJSON.version;

export async function activate(context: ExtensionContext) {
	Configuration.configure(context);
	Logger.configure(context);

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	const serverModule = context.asAbsolutePath("../codestream-lsp-agent/out/agent.js");
	const serverOptions: ServerOptions = {
		run: {
			module: serverModule,
			transport: TransportKind.ipc
		},
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: {
				execArgv: ["--nolazy"] //"--inspect-brk=6009"
			}
		}
	};

	const git = await gitPath();

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		initializationOptions: {
			extensionVersion: extensionVersion,
			gitPath: git,
			ideVersion: vscodeVersion
		},
		// Register the server for file-based text documents
		documentSelector: [{ scheme: "file", language: "*" }],
		synchronize: {
			// Synchronize the setting section 'codestream' to the server
			configurationSection: "codestream"
		}
	};

	const agent = new LanguageClient("codestream", "CodeStream", serverOptions, clientOptions);
	agent.registerProposedFeatures();

	const cfg = configuration.get<Config>();
	await Container.initialize(context, cfg, agent);

	context.subscriptions.push(
		agent.start(),
		Container.session.onDidChangeStatus(onSessionStatusChanged)
	);

	await agent.onReady();
	agent.onRequest<any, Promise<GitApiRepository[]>>(
		"codeStream/client/git/repos",
		onGitReposRequest
	);

	if (cfg.autoSignIn) {
		Container.commands.signIn();
	}
}

export async function deactivate(): Promise<void> {}

function onSessionStatusChanged(e: SessionStatusChangedEvent) {
	const status = e.getStatus();
	setContext(ContextKeys.Status, status);
}

async function onGitReposRequest(method: string, ...params: any[]): Promise<GitApiRepository[]> {
	const repos = await getRepositories();
	return repos.map(r => ({ rootUri: r.rootUri.toString() }));
}
