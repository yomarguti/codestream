"use strict";
import {
	env,
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
import { ContextKeys, GlobalState, setContext } from "./common";
import { Config, configuration, Configuration } from "./configuration";
import { extensionQualifiedId } from "./constants";
import { Container } from "./container";
import { Logger, TraceLevel } from "./logger";
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
	Logger.configure(context, configuration.get<TraceLevel>(configuration.name("traceLevel").value));

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

	showStartupMessage(context, extensionVersion);

	context.globalState.update(GlobalState.Version, extensionVersion);

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

async function showStartupMessage(context: ExtensionContext, version: string) {
	const previousVersion = context.globalState.get<string>(GlobalState.Version);

	if (previousVersion !== version) {
		Logger.log(
			`CodeStream upgraded ${
				previousVersion === undefined ? "" : `from v${previousVersion} `
			}to v${version}`
		);
	}

	const [major, minor] = version.split(".");

	if (previousVersion !== undefined) {
		const [prevMajor, prevMinor] = previousVersion.split(".");
		if (
			(major === prevMajor && minor === prevMinor) ||
			// Don't notify on downgrades
			(major < prevMajor || (major === prevMajor && minor < prevMinor))
		) {
			return;
		}
	}

	const actions: MessageItem[] = [{ title: "What's New" } /*, { title: "Release Notes" } */];

	const result = await window.showInformationMessage(
		`CodeStream has been updated to v${version} — check out what's new!`,
		...actions
	);

	if (result != null) {
		if (result === actions[0]) {
			await env.openExternal(
				Uri.parse(
					`https://codestream.com/codesteam-v${major}-${minor}-vscode?utm_source=ext_vsc&utm_medium=popup&utm_campaign=v${major}-${minor}`
				)
			);
		}
		// else if (result === actions[1]) {
		// 	await env.openExternal(
		// 		Uri.parse("https://marketplace.visualstudio.com/items/CodeStream.codestream/changelog")
		// 	);
		// }
	}
}
