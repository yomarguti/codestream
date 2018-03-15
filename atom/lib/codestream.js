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
	noAccess,
	noRemoteUrl,
	setRepoAttributes,
	setRepoUrl,
	resetContext,
	setContext,
	setCurrentFile,
	setCurrentCommit
} from "./actions/context";
import { foundMultipleRemotes } from "./actions/onboarding";
import { setStreamUMITreatment } from "./actions/umi";
import { markPathsModified } from "./actions/stream";
import logger from "./util/Logger";
import { online, offline } from "./actions/connectivity";

const env = sessionStorage.getItem("codestream.env") || "production";
if (env === "production") {
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

let store;

const getCurrentCommit = async repo => {
	try {
		const data = await git(["show-ref", "--head", "HEAD"], {
			cwd: repo.getWorkingDirectory()
		});
		const head = data
			.split("\n")
			.map(record => {
				const [hash, ref] = record.split(/\s/);
				return { hash, ref };
			})
			.find(({ ref }) => ref === "HEAD");

		if (head) return head.hash;
		else throw { message: "No commit found for HEAD" }; // TODO: figure out what to tell user
	} catch ({ missingGit, message }) {
		if (missingGit) store.dispatch(noGit());
		else
			Raven.captureMessage("There was an unexpected error trying to retrieve the current commit.", {
				level: "error",
				logger: "codestream.js",
				extra: { message }
			});
	}
};

const reloadPlugin = codestream => {
	store.dispatch({ type: "RESET" });
	bootstrapStore(store);
	codestream.view && codestream.view.update(store);

	codestream.deactivate();
	codestream.activate();
	codestream.consumeStatusBar(codestream.statusBar);
	codestream.setup();
};

module.exports = {
	subscriptions: null,
	view: null,
	statusBar: null,
	config: {
		showHeadshots: {
			description: "Display headshots in the stream",
			type: "boolean",
			default: true
		},
		showUnread: {
			description:
				"Note that you can override this setting on a per-file or per-directory basis by right-clicking the Tree View.",
			title: "Files with Unread Messages",
			type: "string",
			default: "badge",
			enum: [
				{ value: "badge", description: "Display a badge to the right of the file" },
				{ value: "bold", description: "Bold the filename" }
			]
		}
	},

	initialize(state) {
		this.subscriptions = new CompositeDisposable();
		store = createStore(state);
		bootstrapStore(store);
		Promise.all(
			atom.project.getDirectories().map(atom.project.repositoryForDirectory.bind(atom.project))
		).then(repos => {
			repos = repos.filter(Boolean);
			if (repos.length === 1) {
				// if being initialized much later into atom's lifetime, i.e. just installed or re-enabled
				if (atom.packages.hasActivatedInitialPackages()) this.setup();
				else
					// wait for atom workspace to be ready
					this.subscriptions.add(atom.packages.onDidActivateInitialPackages(() => this.setup()));
			}
		});
		// this isn't aded to this.subscriptions because it should always run
		atom.project.onDidChangePaths(paths => reloadPlugin(this));
	},

	activate(state) {
		this.subscriptions = this.subscriptions || new CompositeDisposable();
		this.subscriptions.add(
			atom.workspace.addOpener(uri => {
				if (uri === CODESTREAM_VIEW_URI) {
					if (this.view) return this.view;

					this.view = new CodestreamView(store);
					return this.view;
				}
			}),
			atom.commands.add("atom-workspace", {
				"codestream:toggle": () => atom.workspace.toggle(CODESTREAM_VIEW_URI),
				"codestream:logout": () => store.dispatch(logout()),
				"codestream:reset": () => {
					db.delete();
					atom.commands.dispatch(document.querySelector("atom-workspace"), "codestream:logout");
					store.dispatch({ type: "RESET" });
					atom.reload();
				}
			}),
			atom.commands.add(".tree-view", {
				"codestream:mute": target => this.markStreamMute(target),
				"codestream:bold": target => this.markStreamBold(target),
				"codestream:badge": target => this.markStreamBadge(target)
			})
			// atom.commands.add(".codestream .compose.mentions-on", {
			// 	"codestream:at-mention-move-up": event => this.handleAtMentionKeyPress(event, "up"),
			// 	"codestream:at-mention-move-down": event => this.handleAtMentionKeyPress(event, "down"),
			// 	"codestream:at-mention-escape": event => this.handleAtMentionKeyPress(event, "escape")
			// })
		);
		// Dev mode goodies
		if (atom.inDevMode()) {
			this.subscriptions.add(
				atom.commands.add("atom-workspace", {
					"codestream:wipe-cache": () => db.delete(),
					"codestream:point-to-dev": () => {
						sessionStorage.setItem("codestream.env", "dev");
						sessionStorage.setItem("codestream.url", "https://tca3.codestream.us:9443");
						store.dispatch(logout());
						atom.reload();
					},
					"codestream:point-to-local": () => {
						sessionStorage.setItem("codestream.env", "local");
						sessionStorage.setItem("codestream.url", "https://localhost.codestream.us:12079");
						store.dispatch(logout());
						atom.reload();
					},
					"codestream:point-to-qa": () => {
						sessionStorage.setItem("codestream.env", "qa");
						sessionStorage.setItem("codestream.url", "https://qa-api.codestream.us");
						store.dispatch(logout());
						atom.reload();
					},
					"codestream:point-to-production": () => {
						sessionStorage.removeItem("codestream.env");
						sessionStorage.removeItem("codestream.url");
						store.dispatch(logout());
						atom.reload();
					},
					"codestream:which-environment?": () => {
						const urlConfig = sessionStorage.getItem("codestream.url") || "production";
						atom.notifications.addInfo(`CodeStream is pointed to ${urlConfig}`, {
							dismissable: true
						});
					}
				})
			);
		}
	},

	deactivate() {
		this.subscriptions.dispose();
		if (this.statusBarTile) this.statusBarTile.destroy();
		store.dispatch(logout());
	},

	serialize() {
		const { session, onboarding, context, repoAttributes, messaging } = store.getState();
		return {
			onboarding:
				onboarding.complete || onboarding.step === "login"
					? { ...onboarding, errors: {} }
					: undefined,
			context: {
				...context,
				noAccess: false
			},
			session,
			repoAttributes,
			messaging: {
				...messaging,
				failedSubscriptions: [],
				timedOut: false,
				historyRetrievalFailure: false
			}
		};
	},

	deserializeCodestreamView(data) {
		this.view = new CodestreamView(store);
		return this.view;
	},

	async setup() {
		const directories = atom.project.getDirectories();
		const repoPromises = directories.map(repo => atom.project.repositoryForDirectory(repo));
		const allRepos = await Promise.all(repoPromises);
		const repos = allRepos.filter(Boolean);

		if (repos.length === 1) {
			const repo = repos[0];
			getCurrentCommit(repo).then(commitHash => store.dispatch(setCurrentCommit(commitHash)));

			this.subscriptions.add(
				atom.workspace.observeActiveTextEditor(editor => {
					// Only dispatch the action if there is a current file that belongs to the git repo
					// that way if a user looks at settings or a non-repo file,
					// the stream for the last active repo file is still visible
					if (editor) {
						const directoryForFile = directories.find(directory =>
							directory.contains(editor.getPath())
						);
						if (directoryForFile) {
							atom.project.repositoryForDirectory(directoryForFile).then(repo => {
								if (repo) {
									let path = repo.relativize(editor.getPath());
									// note we always maintain the current file with a forward slash separator
									// even if we are on a Windows machine using a backslash
									path = path.replace("\\", "/");
									store.dispatch(setCurrentFile(path));
								} else store.dispatch(setCurrentFile(null));
							});
						}
					} else {
						// in the case of no editor, for example the settings page,
						// we display the "intro" welcome to codestream text, which
						// is handled by lib/components/Stream.js when there is no file
						store.dispatch(setCurrentFile(null));
					}
				}),

				// Subscribe to git status changes in order to be aware of current commit hash.
				repo.onDidChangeStatuses(async event => {
					const { context } = store.getState();
					const currentCommit = await getCurrentCommit(repo);
					if (context.currentCommit !== currentCommit) {
						store.dispatch(commitHashChanged(currentCommit));
					}
				}),
				repo.onDidChangeStatus(event => {
					if (event && event.path) this.checkEditorsForModification(repo);
				}),
				repo.onDidChangeStatuses(() => {
					this.checkEditorsForModification(repo);
				})
			);

			window.addEventListener("online", e => store.dispatch(online()), false);
			window.addEventListener("offline", e => store.dispatch(offline()), false);

			const repoAttributes = store.getState().repoAttributes;
			if (_.isEmpty(repoAttributes) || !repoAttributes.url) {
				const workDir = repo.getWorkingDirectory();
				try {
					const noParentCommits = await git(["rev-list", "--max-parents=0", "--reverse", "HEAD"], {
						cwd: workDir
					});
					store.dispatch(
						setRepoAttributes({
							workingDirectory: workDir,
							firstCommitHash: noParentCommits
								.split("\n")
								.filter(
									string =>
										Boolean(string) && !string.includes("warning: refname 'HEAD' is ambiguous")
								)[0]
						})
					);
				} catch ({ missingGit, message }) {
					if (missingGit) store.dispatch(noGit());
					else
						Raven.captureMessage(
							"There was an unexpected error trying to get the first commit hash.",
							{
								level: "error",
								logger: "codestream.js",
								extra: { message }
							}
						);
				}
				GitRepo.open(workDir)
					.listRemoteReferences()
					.then(remotes => {
						const uniqueRemotes = _.uniq(remotes, r => r.name);
						if (uniqueRemotes.length === 0) store.dispatch(noRemoteUrl());
						if (uniqueRemotes.length === 1) store.dispatch(setRepoUrl(uniqueRemotes[0].url));
						else store.dispatch(foundMultipleRemotes(uniqueRemotes));
					});
			}
		}
	},

	async checkEditorsForModification(repo) {
		let edited = [];
		atom.workspace
			.getCenter()
			.getTextEditors()
			.forEach(editor => {
				let filePath = editor.getPath();
				if (repo.isPathModified(filePath) || editor.isModified())
					edited.push(repo.relativize(filePath));
			});
		store.dispatch(markPathsModified(edited));
	},

	markStreamMute(event) {
		this.markStreamTreatment(event, "mute");
	},
	markStreamBold(event) {
		this.markStreamTreatment(event, "bold");
	},
	markStreamBadge(event) {
		this.markStreamTreatment(event, "badge");
	},
	// set a preference for the treatment of a given stream
	// to either mute, bold, or badge
	markStreamTreatment(event, setting) {
		let li = event.target.closest("li");

		// TODO if there isn't a click event, use the active li from tree-veiw
		if (!li) return;

		let type = li.classList.contains("directory") ? "directory" : "file";
		let path = li.getElementsByTagName("span")[0].getAttribute("data-path");
		// setStreamUMITreatment(path, setting);
		store.dispatch(setStreamUMITreatment(path, setting));
	},

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
