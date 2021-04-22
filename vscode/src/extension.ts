"use strict";
import { ProtocolHandler } from "protocolHandler";
import {
	Disposable,
	env,
	ExtensionContext,
	extensions,
	MessageItem,
	Uri,
	version as vscodeVersion,
	window,
	workspace
} from "vscode";
import { ScmTreeDataProvider } from "views/scmTreeDataProvider";
import { CodeStreamWebviewSidebar } from "webviews/webviewSidebar";
import { WebviewLike } from "webviews/webviewLike";

import { CodemarkType } from "@codestream/protocols/api";
import {
	CreatePullRequestActionContext,
	GitLensApi,
	HoverCommandsActionContext,
	OpenPullRequestActionContext
} from "./@types/gitlens";
import { GitExtension } from "./@types/git";
import { SessionStatus, SessionStatusChangedEvent } from "./api/session";
import { ContextKeys, GlobalState, setContext } from "./common";
import { Config, configuration, Configuration } from "./configuration";
import { extensionQualifiedId } from "./constants";
import { Container } from "./container";
import { Logger, TraceLevel } from "./logger";
import { FileSystem, Strings, Versions } from "./system";

const extension = extensions.getExtension(extensionQualifiedId)!;
export const extensionVersion = extension.packageJSON.version;

const gitLensDisposables: Disposable[] = [];
let gitLensApiLocatorPromise: Promise<GitLensApi> | undefined;
let gitLensLastHoverContext: { timestamp: Date; context: HoverCommandsActionContext } | undefined;

interface BuildInfoMetadata {
	buildNumber: string;
	assetEnvironment: string;
}

export async function activate(context: ExtensionContext) {
	const start = process.hrtime();
	Configuration.configure(context);
	Logger.configure(context, configuration.get<TraceLevel>(configuration.name("traceLevel").value));

	let info = await FileSystem.loadJsonFromFile<BuildInfoMetadata>(
		context.asAbsolutePath(`github-enterprise-${extensionVersion}.info`)
	);
	if (info === undefined) {
		info = { buildNumber: "", assetEnvironment: "dev" };
	}

	const edition = env.appName;
	const editionFormat = `${edition.indexOf(" Insiders") > -1 ? " (Insiders)" : ""}`;
	const formattedVersion = `${extensionVersion}${info.buildNumber ? `-${info.buildNumber}` : ""}${
		info.assetEnvironment && info.assetEnvironment !== "prod" ? ` (${info.assetEnvironment})` : ""
	}`;
	Logger.log(
		`CodeStream${editionFormat} v${formattedVersion} in VS Code (v${vscodeVersion}) starting${
			Logger.isDebugging ? " in debug mode" : ""
		}...`
	);

	const git = await gitPath();

	let cfg = configuration.get<Config>();

	if (cfg.serverUrl[cfg.serverUrl.length - 1] === "/") {
		await configuration.updateEffective(
			configuration.name("serverUrl").value,
			cfg.serverUrl.substr(0, cfg.serverUrl.length - 1)
		);

		cfg = configuration.get<Config>();
	}

	let webviewLikeSidebar: (WebviewLike & CodeStreamWebviewSidebar) | undefined = undefined;
	// this plumping lives here rather than the WebviewController as it needs to get activated here
	webviewLikeSidebar = new CodeStreamWebviewSidebar(Container.session, context.extensionUri);
	context.subscriptions.push(
		window.registerWebviewViewProvider(CodeStreamWebviewSidebar.viewType, webviewLikeSidebar, {
			webviewOptions: {
				retainContextWhenHidden: true
			}
		})
	);

	await Container.initialize(
		context,
		cfg,
		{
			extension: {
				build: info.buildNumber,
				buildEnv: info.assetEnvironment,
				version: extensionVersion,
				versionFormatted: formattedVersion
			},
			gitPath: git,
			ide: {
				name: "VS Code",
				version: vscodeVersion,
				// Visual Studio Code or Visual Studio Code - Insiders
				detail: edition
			},
			isDebugging: Logger.isDebugging,
			serverUrl: cfg.serverUrl,
			disableStrictSSL: cfg.disableStrictSSL,
			traceLevel: Logger.level,
			machineId: env.machineId
		},
		webviewLikeSidebar
	);

	const scmTreeDataProvider = new ScmTreeDataProvider();
	window.registerTreeDataProvider("github-enterprise.scmTreeDataProvider", scmTreeDataProvider);

	context.subscriptions.push(scmTreeDataProvider);

	context.subscriptions.push(Container.session.onDidChangeSessionStatus(onSessionStatusChanged));
	context.subscriptions.push(new ProtocolHandler());

	const previousVersion = context.globalState.get<string>(GlobalState.Version);
	showStartupUpgradeMessage(extensionVersion, previousVersion);
	if (previousVersion === undefined) {
		// show CS on initial install
		await Container.webview.show();
	}

	context.globalState.update(GlobalState.Version, extensionVersion);

	Logger.log(
		`CodeStream${editionFormat} v${formattedVersion} started \u2022 ${Strings.getDurationMilliseconds(
			start
		)} ms`
	);

	gitLensApiLocatorPromise = locateGitLensIntegration();
	gitLensApiLocatorPromise
		.then(api => {
			if (!api) {
				Logger.warn("GitLens: missing api");
				return;
			}

			api.registerActionRunner<HoverCommandsActionContext>("hover.commands", {
				partnerId: "codestream",
				name: "CodeStream",
				label: "$(comment) Leave a Comment",
				run: function(context: HoverCommandsActionContext) {
					try {
						if (!Container.session.signedIn) {
							// store the last context with a timestamp
							// to try and re-run it later
							gitLensLastHoverContext = { timestamp: new Date(), context: context };
						}
						// run it anyway -- it will pop open
						runGitLensHoverCommand(context);
					} catch (e) {
						Logger.warn(`GitLens: hover.commands. Failed to handle actionRunner e=${e}`);
					}
				}
			});
		})
		.catch(_ => {
			Logger.warn(`GitLens: catch ${_}`);
		});

	context.subscriptions.push(
		Container.agent.onUserDidCommit(e => {
			const preferences = Container.session.user.preferences;
			if (!preferences || preferences.reviewCreateOnCommit !== false) {
				Logger.log(`User committed ${e.sha} - opening feedback request form`);
				Container.webview.newReviewRequest(undefined, "VSC Commit Detected", true);
			}
		}),
		Container.session.onDidChangeSessionStatus(event => {
			const status = event.getStatus();
			if (status === SessionStatus.SignedOut) {
				if (gitLensDisposables && gitLensDisposables.length) {
					gitLensDisposables.forEach(_ => _.dispose());
					return;
				}
			}
			if (status === SessionStatus.SignedIn) {
				if (gitLensDisposables && gitLensDisposables.length) {
					gitLensDisposables.forEach(_ => _.dispose());
				}

				registerGitLensIntegration();

				setTimeout(() => {
					if (!gitLensLastHoverContext || !gitLensLastHoverContext.context) return;

					const now = new Date();
					now.setMinutes(now.getMinutes() - 5);
					// only re-run this if it happened in the last N minutes
					if (gitLensLastHoverContext.timestamp >= now) {
						runGitLensHoverCommand(gitLensLastHoverContext.context);
					}
					gitLensLastHoverContext = undefined;
				}, 1000);
			}
		})
	);
}

function runGitLensHoverCommand(context: HoverCommandsActionContext) {
	if (!context) return;

	Container.webview.newCodemarkRequest(
		CodemarkType.Comment,
		context.file
			? ({
					document: {
						uri: Uri.parse(context.file.uri)
					} as any,
					selection: {
						start: {
							line: context.file.line
						} as any
					} as any
			  } as any)
			: undefined,
		"VSC GitLens",
		false
	);
}

function locateGitLensIntegration() {
	return new Promise<GitLensApi>((resolve, reject) => {
		try {
			const getGitLens = () =>
				extensions.getExtension<Promise<GitLensApi>>("eamodio.gitlens") ||
				extensions.getExtension<Promise<GitLensApi>>("eamodio.gitlens-insiders");

			let gitlens = getGitLens();
			if (!gitlens) {
				Logger.log("GitLens: Not installed.");
				if (Container.session.user.hasGitLens !== false) {
					Container.agent.users.updateUser({ hasGitLens: false });
				}
				reject();
				return;
			}

			let i = 0;
			// NOTE: there's no event to listen to when another extension has activated
			// so we have to poll to keep checking it. Open issue for that is:
			// https://github.com/microsoft/vscode/issues/113783
			const timeout = setTimeout(async _ => {
				gitlens = getGitLens();
				if (!gitlens) {
					Logger.log(`GitLens: Not detected. Returning. attempt=${i}`);
					clearInterval(timeout);
					if (Container.session.user.hasGitLens !== false) {
						Container.agent.users.updateUser({ hasGitLens: false });
					}
					reject();
					return;
				}
				if (gitlens.isActive) {
					try {
						const api: GitLensApi = await gitlens.exports;
						resolve(api);
					} catch (e) {
						Logger.warn(`GitLens: Failed to register. Giving up. attempt=${i} e=${e}`);
						reject();
					} finally {
						clearInterval(timeout);
					}
				} else {
					Logger.log(`GitLens: Not detected yet. attempt=${i}`);
					i++;
					if (i === 60) {
						Logger.warn(`GitLens: Activation giving up. attempt=${i}`);
						clearInterval(timeout);
						reject();
						return;
					}
				}
			}, 10000);
		} catch (e) {
			Logger.warn(`GitLens: generic error e=${e}`);
			reject();
		}
	});
}

async function registerGitLensIntegration() {
	try {
		const api = await gitLensApiLocatorPromise;
		if (!api) {
			return;
		}

		gitLensDisposables.push(
			api.registerActionRunner<OpenPullRequestActionContext>("openPullRequest", {
				partnerId: "codestream",
				name: "CodeStream",
				label: "Open Pull Request in VS Code",
				run: function(context: OpenPullRequestActionContext) {
					try {
						let providerName;
						if (typeof (context.pullRequest as any).provider === "string") {
							providerName = (context.pullRequest as any).provider;
						} else if (typeof (context.pullRequest as any).provider === "object") {
							providerName = (context.pullRequest as any).provider.name;
						} else if (context.provider) {
							// later this won't be a string in the next GitLens version
							providerName = context.provider.name;
						}

						const isGitHub = providerName === "GitHub";
						if (isGitHub) {
							Container.webview.openPullRequestByUrl(context.pullRequest.url, "VSC GitLens");
						} else {
							Logger.log(`GitLens: openPullRequest. No provider for ${providerName}`);
						}
					} catch (e) {
						Logger.warn(
							`GitLens: openPullRequest. Failed to handle actionRunner openPullRequest e=${e}`
						);
					}
				}
			}),
			api.registerActionRunner<CreatePullRequestActionContext>("createPullRequest", {
				partnerId: "codestream",
				name: "CodeStream",
				label: "Create Pull Request in VS Code",
				run: function(context: CreatePullRequestActionContext) {
					try {
						if (context.branch) {
							const editor = window.activeTextEditor;
							Container.webview.newPullRequestRequest(
								editor && editor.selection && !editor.selection.isEmpty ? editor : undefined,
								"VSC GitLens",
								{
									name: context.branch.name,
									repoPath: context.repoPath,
									remote: (context.branch as any).remote || context.remote
								}
							);
						} else {
							Logger.log("GitLens: createPullRequest. No branch and/or remote");
						}
					} catch (e) {
						Logger.warn(
							`GitLens: createPullRequest. Failed to handle actionRunner createPullRequest e=${e}`
						);
					}
				}
			})
		);
	} catch (e) {
		Logger.warn(`GitLens: generic error e=${e}`);
	}
}

export async function deactivate(): Promise<void> {
	Container.agent.dispose();
}

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

// Add any versions here that we want to skip for blog posts
const skipVersions = [Versions.from(1, 2)];

async function showStartupUpgradeMessage(version: string, previousVersion: string | undefined) {
	// if this is the first install, there is no previous message... don't show
	if (!previousVersion) return;

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
			major < prevMajor ||
			(major === prevMajor && minor < prevMinor)
		) {
			return;
		}
	}

	const compareTo = Versions.from(major, minor);
	if (skipVersions.some(v => Versions.compare(compareTo, v) === 0)) return;

	const actions: MessageItem[] = [{ title: "What's New" } /* , { title: "Release Notes" } */];

	const result = await window.showInformationMessage(
		`CodeStream has been updated to v${version} — check out what's new!`,
		...actions
	);

	if (result != null) {
		if (result === actions[0]) {
			await env.openExternal(
				Uri.parse(
					`https://www.codestream.com/blog/codestream-v${major}-${minor}?utm_source=ext_vsc&utm_medium=popup&utm_campaign=v${major}-${minor}`
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
