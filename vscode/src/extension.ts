"use strict";
import "reflect-metadata";

import { ExtensionContext, extensions, version as vscodeVersion } from "vscode";
import { CodeStreamAgentOptions } from "./agentClient";
import { SessionStatusChangedEvent } from "./api/session";
import { ContextKeys, setContext } from "./common";
import { Config, configuration, Configuration } from "./configuration";
import { extensionQualifiedId } from "./constants";
import { Container } from "./container";
import { gitPath } from "./git/git";
import { Logger } from "./logger";

const extension = extensions.getExtension(extensionQualifiedId)!;
export const extensionVersion = extension.packageJSON.version;

export async function activate(context: ExtensionContext) {
	Configuration.configure(context);
	Logger.configure(context);

	const git = await gitPath();

	const cfg = configuration.get<Config>();
	await Container.initialize(context, cfg, {
		extensionVersion: extensionVersion,
		gitPath: git,
		ideVersion: vscodeVersion,
		serverUrl: cfg.serverUrl
	} as CodeStreamAgentOptions);

	context.subscriptions.push(Container.session.onDidChangeStatus(onSessionStatusChanged));

	if (cfg.autoSignIn) {
		Container.commands.signIn();
	}
}

export async function deactivate(): Promise<void> {}

function onSessionStatusChanged(e: SessionStatusChangedEvent) {
	const status = e.getStatus();
	setContext(ContextKeys.Status, status);
}
