"use strict";
import {
	commands,
	ExtensionContext,
	extensions,
	MessageItem,
	Uri,
	version as vscodeVersion,
	window,
	workspace
} from "vscode";
import { GitExtension } from "./@types/git";
import { SessionStatusChangedEvent } from "./api/session";
import { ContextKeys, setContext } from "./common";
import { Config, configuration, Configuration } from "./configuration";
import { BuiltInCommands } from "./constants";
import { extensionQualifiedId } from "./constants";
import { Container } from "./container";
import { Logger } from "./logger";
import { FileSystem, Strings } from "./system";

const extension = extensions.getExtension(extensionQualifiedId)!;
export const extensionVersion = extension.packageJSON.version;

interface BuildInfoMetadata {
	buildNumber: string;
	assetEnvironment: string;
}

export async function activate(context: ExtensionContext) {
	const start = process.hrtime();

	Configuration.configure(context);
	Logger.configure(context);

	let info = await FileSystem.loadJsonFromFile<BuildInfoMetadata>(
		context.asAbsolutePath(`codestream-${extensionVersion}.info`)
	);
	if (info === undefined) {
		info = { buildNumber: "", assetEnvironment: "dev" };
	}

	const formattedVersion = `${extensionVersion}${info.buildNumber ? `-${info.buildNumber}` : ""}${
		info.assetEnvironment && info.assetEnvironment !== "prod" ? ` (${info.assetEnvironment})` : ""
	}`;
	Logger.log(
		`CodeStream v${formattedVersion} in VS Code (v${vscodeVersion}) starting${
			Logger.isDebugging ? " in debug mode" : ""
		}...`
	);

	const git = await gitPath();

	const cfg = configuration.get<Config>();
	await Container.initialize(context, cfg, {
		extension: {
			build: info.buildNumber,
			buildEnv: info.assetEnvironment,
			version: extensionVersion,
			versionFormatted: formattedVersion
		},
		gitPath: git,
		ide: {
			name: "VS Code",
			version: vscodeVersion
		},
		isDebugging: Logger.isDebugging,
		serverUrl: cfg.serverUrl,
		traceLevel: Logger.level
	});

	context.subscriptions.push(Container.session.onDidChangeSessionStatus(onSessionStatusChanged));

	showStartupMessage(context);

	if (cfg.autoSignIn) {
		Container.commands.signIn();
	}

	Logger.log(
		`CodeStream v${formattedVersion} started \u2022 ${Strings.getDurationMilliseconds(start)} ms`
	);
}

export async function deactivate(): Promise<void> {}

function onSessionStatusChanged(e: SessionStatusChangedEvent) {
	const status = e.getStatus();
	setContext(ContextKeys.Status, status);
}

let _gitPath: string | undefined;
export async function gitPath(): Promise<string> {
	if (_gitPath === undefined) {
		try {
			const gitExtension = extensions.getExtension("vscode.git");
			if (gitExtension !== undefined) {
				const gitApi = ((gitExtension.isActive
					? gitExtension.exports
					: await gitExtension.activate()) as GitExtension).getAPI(1);
				_gitPath = gitApi.git.path;
			}
		} catch {}

		if (_gitPath === undefined) {
			_gitPath = workspace.getConfiguration("git").get<string>("path") || "git";
		}
	}
	return _gitPath;
}

async function showStartupMessage(context: ExtensionContext) {
	if (
		context.globalState.get<boolean>("2019-01-giveaway", false) ||
		new Date() > new Date("2019-2-2 12:00 GMT-0500")
	) {
		return;
	}

	await context.globalState.update("2019-01-giveaway", true);

	const actions: MessageItem[] = [{ title: "See Details" }];
	const result = await window.showInformationMessage(
		`Don't miss your chance to win up to $250 in CodeStream's Codemarks Giveaway — simply by creating Codemarks`,
		...actions
	);

	if (result === actions[0]) {
		commands.executeCommand(
			BuiltInCommands.Open,
			Uri.parse(
				"https://blog.codestream.com/index.php/2019/01/24/codestreams-codemarks-giveaway?utm_source=ext_vsc&utm_medium=popup&utm_campaign=giveaway_codemarks"
			)
		);
	}
}
