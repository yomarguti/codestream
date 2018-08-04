import os from "os";
import { CompositeDisposable } from "atom";
import _ from "underscore-plus";
import Raven from "raven-js";
import CodestreamView, { CODESTREAM_VIEW_URI } from "./codestream-view";
import db, { bootstrapStore } from "./local-cache";
import * as GitRepo from "./git/GitRepo";
import git from "./git";
import createStore from "./createStore";
import {
	commitHashChanged,
	logout,
	noGit,
	noRemoteUrl,
	setRepoAttributes,
	setRepoUrl,
	setCurrentFile,
	setCurrentCommit,
	setHasFocus
} from "./actions/context";
import { updateConfigs } from "./actions/configs";
import { foundMultipleRemotes } from "./actions/onboarding";
import logger from "./util/Logger";
import { online, offline } from "./actions/connectivity";
import { calculateUncommittedMarkers } from "./actions/marker-location";
import { setActive } from "./actions/presence";
import { setUserPreference } from "./actions/user";
import WorkspaceSession from "./workspace/workspace-session";

const env = sessionStorage.getItem("codestream.env") || "production";
if (false) {
	Raven.config("https://46fd0a63e10340b585d895d333fec719@sentry.io/280733", {
		captureUnhandledRejections: true,
		tags: {
			process: process.type,
			platform: os.platform(),
			platformRelease: os.release(),
			atom: atom.getVersion(),
			codestreamEnv: env,
			pluginVersion: atom.packages.getLoadedPackage("CodeStream").metadata.version
		}
	}).install();
	window.addEventListener("unhandledrejection", function(event) {
		Raven.captureException(event.reason);
	});
}

logger.addHandler((level, msg) => {
	console.log(`[${level}] ${msg}`);
});

let workspaceSession;
let store;

// const getCurrentCommit = async repo => {
// 	try {
// 		const data = await git(["show-ref", "--head", "HEAD"], {
// 			cwd: repo.getWorkingDirectory()
// 		});
// 		const head = data
// 			.split("\n")
// 			.map(record => {
// 				const [hash, ref] = record.split(/\s/);
// 				return { hash, ref };
// 			})
// 			.find(({ ref }) => ref === "HEAD");
//
// 		if (head) return head.hash;
// 		else throw { message: "No commit found for HEAD" }; // TODO: figure out what to tell user
// 	} catch ({ missingGit, message }) {
// 		if (missingGit) store.dispatch(noGit());
// 		else
// 			Raven.captureMessage("There was an unexpected error trying to retrieve the current commit.", {
// 				level: "error",
// 				logger: "codestream.js",
// 				extra: { message }
// 			});
// 	}
// };

module.exports = {
	subscriptions: null,
	view: null,
	statusBar: null,
	config: {
		showHeadshots: {
			description: "Display headshots in the stream.",
			type: "boolean",
			default: true
		},
		reduceMotion: {
			description: "Reduce the animations when transitioning between streams.",
			type: "boolean",
			default: false
		},
		emailNotifications: {
			description:
				"Send email notifications for new messages when Atom is closed, or I've been idle.",
			type: "boolean",
			default: true
		}
	},

	initialize(state) {
		this.subscriptions = new CompositeDisposable();
		workspaceSession = new WorkspaceSession(state.workspaceSession);
		store = createStore(
			{ ...state.viewState, configs: atom.config.get("CodeStream") },
			workspaceSession.viewApi
		);
		bootstrapStore(store);
	},

	async activate(_state) {
		this.subscriptions = this.subscriptions || new CompositeDisposable();
		this.subscriptions.add(
			atom.workspace.addOpener(uri => {
				if (uri === CODESTREAM_VIEW_URI) {
					if (this.view && this.view.alive) return this.view;
					this.view = new CodestreamView(store);
					return this.view;
				}
			}),
			atom.commands.add("atom-workspace", {
				"codestream:toggle": () => atom.workspace.toggle(CODESTREAM_VIEW_URI),
				"codestream:reset": () => {
					// db.delete();
					atom.commands.dispatch(document.querySelector("atom-workspace"), "codestream:logout");
					store.dispatch({ type: "RESET" });
					workspaceSession.logout();
					// atom.reload();
				}
			}),
			atom.config.observe("CodeStream", configs => {
				store.dispatch(updateConfigs(configs));
			}),
			atom.config.observe("CodeStream.emailNotifications", setting => {
				store.dispatch(setUserPreference(["emailNotifications"], setting ? "on" : "off"));
			})
		);

		// Dev mode goodies
		const hiddenInCommandPalette = !atom.inDevMode();
		this.subscriptions.add(
			atom.commands.add("atom-workspace", "codestream:wipe-cache", {
				didDispatch: () => db.delete(),
				hiddenInCommandPalette
			}),
			atom.commands.add("atom-workspace", "codestream:point-to-dev", {
				didDispatch: () => {
					sessionStorage.setItem("codestream.env", "dev");
					sessionStorage.setItem("codestream.url", "https://pd-api.codestream.us:9443");
					store.dispatch(logout());
					atom.reload();
				},
				hiddenInCommandPalette
			}),
			atom.commands.add("atom-workspace", "codestream:point-to-local", {
				didDispatch: () => {
					sessionStorage.setItem("codestream.env", "local");
					sessionStorage.setItem("codestream.url", "https://localhost.codestream.us:12079");
					store.dispatch(logout());
					atom.reload();
				},
				hiddenInCommandPalette
			}),
			atom.commands.add("atom-workspace", "codestream:point-to-qa", {
				didDispatch: () => {
					sessionStorage.setItem("codestream.env", "qa");
					sessionStorage.setItem("codestream.url", "https://qa-api.codestream.us");
					store.dispatch(logout());
					atom.reload();
				},
				hiddenInCommandPalette
			}),
			atom.commands.add("atom-workspace", "codestream:point-to-production", {
				didDispatch: () => {
					sessionStorage.removeItem("codestream.env");
					sessionStorage.removeItem("codestream.url");
					store.dispatch(logout());
					atom.reload();
				},
				hiddenInCommandPalette
			}),
			atom.commands.add("atom-workspace", "codestream:which-environment?", {
				didDispatch: () => {
					const urlConfig = sessionStorage.getItem("codestream.url") || "production";
					atom.notifications.addInfo(`CodeStream is pointed to ${urlConfig}`, {
						dismissable: true
					});
				},
				hiddenInCommandPalette
			})
		);
	},

	deactivate() {
		this.subscriptions.dispose();
		if (this.statusBarTile) this.statusBarTile.destroy();
		store.dispatch(logout());
	},

	serialize() {
		return { workspaceSession: workspaceSession.serialize(), viewState: store.getState() };
	},

	deserializeCodestreamView() {
		this.view = new CodestreamView(store);
		return this.view;
	},

	// async setup() {
	// 	const directories = atom.project.getDirectories();
	// 	const repoPromises = directories.map(repo => atom.project.repositoryForDirectory(repo));
	// 	const allRepos = await Promise.all(repoPromises);
	// 	const repos = allRepos.filter(Boolean);
	//
	// 	if (repos.length === 1) {
	// 		const repo = repos[0];
	// 		getCurrentCommit(repo).then(commitHash => store.dispatch(setCurrentCommit(commitHash)));
	//
	// 		const updateCommitHash = async () => {
	// 			const { context } = store.getState();
	// 			const currentCommit = await getCurrentCommit(repo);
	// 			if (context.currentCommit !== currentCommit) {
	// 				await store.dispatch(calculateUncommittedMarkers());
	// 				store.dispatch(commitHashChanged(currentCommit));
	// 			}
	// 		};
	//
	// 		this.subscriptions.add(
	// 			atom.workspace.observeActiveTextEditor(editor => {
	// 				// Only dispatch the action if there is a current file that belongs to the git repo
	// 				// that way if a user looks at settings or a non-repo file,
	// 				// the stream for the last active repo file is still visible
	// 				if (editor) {
	// 					const directoryForFile = directories.find(directory =>
	// 						directory.contains(editor.getPath())
	// 					);
	// 					if (directoryForFile) {
	// 						atom.project.repositoryForDirectory(directoryForFile).then(repo => {
	// 							if (repo) {
	// 								let path = repo.relativize(editor.getPath());
	// 								// note we always maintain the current file with a forward slash separator
	// 								// even if we are on a Windows machine using a backslash
	// 								path = path.replace("\\", "/");
	// 								store.dispatch(setCurrentFile(path));
	// 							} else store.dispatch(setCurrentFile(null));
	// 						});
	// 					}
	// 				} else {
	// 					// in the case of no editor, for example the settings page,
	// 					// we display the "intro" welcome to codestream text, which
	// 					// is handled by lib/components/Stream.js when there is no file
	// 					store.dispatch(setCurrentFile(null));
	// 				}
	// 			}),
	//
	// 			// Subscribe to git status changes in order to be aware of current commit hash.
	// 			repo.onDidChangeStatuses(event => {
	// 				updateCommitHash();
	// 			})
	// 		);
	//
	// 		window.addEventListener("online", e => store.dispatch(online()), false);
	// 		window.addEventListener("offline", e => store.dispatch(offline()), false);
	// 		window.addEventListener("mousemove", e => store.dispatch(setActive()), false);
	// 		window.addEventListener("keypress", e => store.dispatch(setActive()), false);
	// 		window.addEventListener("focus", e => store.dispatch(setActive()), false);
	// 		window.addEventListener("blur", e => store.dispatch(setHasFocus(false)), false);
	// 		window.addEventListener("focus", e => store.dispatch(setHasFocus(true)), false);
	// 		store.dispatch(setHasFocus(true));
	//
	// 		const repoAttributes = store.getState().repoAttributes;
	// 		if (_.isEmpty(repoAttributes) || !repoAttributes.url) {
	// 			const workDir = repo.getWorkingDirectory();
	// 			try {
	// 				let knownCommitHashes = await getAllKnownCommits(workDir);
	// 				store.dispatch(
	// 					setRepoAttributes({
	// 						workingDirectory: workDir,
	// 						knownCommitHashes
	// 					})
	// 				);
	// 			} catch ({ missingGit, message }) {
	// 				if (missingGit) store.dispatch(noGit());
	// 				else
	// 					Raven.captureMessage(
	// 						"There was an unexpected error trying to get known commit hashes.",
	// 						{
	// 							level: "error",
	// 							logger: "codestream.js",
	// 							extra: { message }
	// 						}
	// 					);
	// 			}
	// 			GitRepo.open(workDir)
	// 				.listRemoteReferences()
	// 				.then(remotes => {
	// 					const uniqueRemotes = _.uniq(remotes, r => r.name);
	// 					if (uniqueRemotes.length === 0) store.dispatch(noRemoteUrl());
	// 					if (uniqueRemotes.length === 1) store.dispatch(setRepoUrl(uniqueRemotes[0].url));
	// 					else store.dispatch(foundMultipleRemotes(uniqueRemotes));
	// 				});
	// 		}
	// 	}
	// },

	consumeStatusBar(statusBar) {
		this.statusBar = statusBar;
		const div = document.createElement("div");
		div.classList.add("inline-block");
		const icon = document.createElement("span");
		icon.classList.add("icon", "icon-comment-discussion");
		icon.onclick = event =>
			atom.commands.dispatch(document.querySelector("atom-workspace"), "codestream:toggle");
		atom.tooltips.add(div, { title: "Toggle CodeStream" });
		div.appendChild(icon);
		this.statusBarTile = statusBar.addRightTile({ item: div, priority: 400 });
	}
};
