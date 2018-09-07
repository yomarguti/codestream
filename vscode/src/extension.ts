"use strict";
import "reflect-metadata";

import { ExtensionContext, extensions, version as vscodeVersion } from "vscode";
import { AgentOptions } from "./agent/agentConnection";
import { SessionStatusChangedEvent } from "./api/session";
import { ContextKeys, setContext } from "./common";
import { Config, configuration, Configuration } from "./configuration";
import { extensionQualifiedId } from "./constants";
import { Container } from "./container";
import { Logger } from "./logger";
import { FileSystem, Strings } from "./system";

const extension = extensions.getExtension(extensionQualifiedId)!;
export const extensionVersion = extension.packageJSON.version;

export async function activate(context: ExtensionContext) {
	const start = process.hrtime();

	Configuration.configure(context);
	Logger.configure(context);

	// Check for an optional build number
	let info = { build: "" };
	try {
		info = await FileSystem.loadJsonFromFile<{ build: string }>(
			context.asAbsolutePath(`codestream-${extensionVersion}.info`)
		);
	} catch {}

	Logger.log(
		`CodeStream v${extensionVersion}${info.build ? `-${info.build}` : ""} starting ${
			Logger.isDebugging ? "in debug mode" : ""
		}...`
	);

	const git = await gitPath();

	const cfg = configuration.get<Config>();
	await Container.initialize(context, cfg, {
		extensionBuild: info.build,
		extensionVersion: extensionVersion,
		gitPath: git,
		ideVersion: vscodeVersion,
		serverUrl: cfg.serverUrl
	} as AgentOptions);

	context.subscriptions.push(Container.session.onDidChangeSessionStatus(onSessionStatusChanged));

	if (cfg.autoSignIn) {
		Container.commands.signIn();
	}

	Logger.log(
		`CodeStream v${extensionVersion}${
			info.build ? `-${info.build}` : ""
		} started \u2022 ${Strings.getDurationMilliseconds(start)} ms`
	);
}

export async function deactivate(): Promise<void> {}

function onSessionStatusChanged(e: SessionStatusChangedEvent) {
	const status = e.getStatus();
	setContext(ContextKeys.Status, status);
}

interface GitExtensionApi {
	getGitPath(): Promise<string>;
}

let _gitApi: GitExtensionApi | undefined;
async function gitApi() {
	if (_gitApi === undefined) {
		try {
			const git = extensions.getExtension("vscode.git");
			if (git === undefined) throw new Error("Git extension not found!");

			_gitApi = git.isActive ? git.exports : await git.activate();
		} catch (ex) {
			debugger;
			Logger.error(ex);
			throw ex;
		}
	}
	return _gitApi!;
}

let _gitPath: string | undefined;
export async function gitPath(): Promise<string> {
	if (_gitPath === undefined) {
		_gitPath = await (await gitApi()).getGitPath();
	}
	return _gitPath;
}
