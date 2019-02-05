import { CompositeDisposable } from "atom";
import { CodestreamView, CODESTREAM_VIEW_URI } from "./codestream-view";
import { actions, createStore, WebviewApi } from "codestream-components";
import { StatusBar, Tile } from "./types/package-services/status-bar";
import { WorkspaceSession } from "./workspace/workspace-session";
import { PackageState } from "./types/package";

class CodestreamPackage {
	subscriptions: CompositeDisposable;
	workspaceSession?: WorkspaceSession;
	statusBar?: StatusBar;
	statusBarTile?: Tile;
	view?: CodestreamView;
	store: any;

	constructor() {
		this.subscriptions = new CompositeDisposable();
	}

	// Package lifecyle 1
	initialize(state: PackageState) {
		this.workspaceSession = WorkspaceSession.create(state);
		this.store = createStore(
			this.workspaceSession.getBootstrapState(),
			{ api: new WebviewApi() },
			[],
		);
		this.store.dispatch(actions.bootstrap(this.workspaceSession.getBootstrapData()));

		this.subscriptions.add(
			atom.workspace.addOpener(uri => {
				if (uri === CODESTREAM_VIEW_URI) {
					if (this.view && this.view.alive) return this.view;
					this.view = new CodestreamView(this.workspaceSession!, this.store);
					return this.view;
				}
			}),
			atom.commands.add("atom-workspace", "codestream:toggle", () =>
				atom.workspace.toggle(CODESTREAM_VIEW_URI),
			),
		);
	}

	// Package lifecyle
	deserializeCodestreamView() {
		this.view = new CodestreamView(this.workspaceSession!, this.store);
		return this.view;
	}

	// Package lifecyle
	activate() {}

	// Package lifecyle
	serialize(): PackageState {
		return this.workspaceSession ? this.workspaceSession.serialize() : {};
	}

	// Package lifecyle
	deactivate() {
		this.subscriptions.dispose();
		if (this.statusBarTile) this.statusBarTile.destroy();
		// this.store.dispatch(logout());
	}

	consumeStatusBar(statusBar: StatusBar) {
		this.statusBar = statusBar;
		const div = document.createElement("div");
		div.classList.add("inline-block");
		const icon = document.createElement("span");
		icon.classList.add("icon", "icon-comment-discussion");
		icon.onclick = event => {
			event.stopPropagation();
			atom.commands.dispatch(document.querySelector("atom-workspace")!, "codestream:toggle");
		};
		atom.tooltips.add(div, { title: "Toggle CodeStream" });
		div.appendChild(icon);
		this.statusBarTile = statusBar.addRightTile({ item: div, priority: 400 });
	}
}

export default new CodestreamPackage();

// export default {
// 	subscriptions: null,
// 	view: null,
// 	statusBar: null,
// 	store: null,
// 	config: {
// 		showHeadshots: {
// 			description: "Display headshots in the stream.",
// 			type: "boolean",
// 			default: true
// 		},
// 		reduceMotion: {
// 			description: "Reduce the animations when transitioning between streams.",
// 			type: "boolean",
// 			default: false
// 		},
// 		emailNotifications: {
// 			description:
// 				"Send email notifications for new messages when Atom is closed, or I've been idle.",
// 			type: "boolean",
// 			default: true
// 		}
// 	},
//
// 	initialize(state) {
// 		this.subscriptions = new CompositeDisposable();
// 		workspaceSession = new WorkspaceSession(state.workspaceSession);
// 		this.store = createStore(
// 			{ ...state.viewState, configs: atom.config.get("CodeStream") },
// 			workspaceSession.viewApi
// 		);
// 		bootstrapStore(this.store);
// 	},
//
// 	async activate(_state) {
// 		this.subscriptions = this.subscriptions || new CompositeDisposable();
// 		this.subscriptions.add(
// 			atom.workspace.addOpener(uri => {
// 				if (uri === CODESTREAM_VIEW_URI) {
// 					if (this.view && this.view.alive) return this.view;
// 					this.view = new CodestreamView(this.store);
// 					return this.view;
// 				}
// 			}),
// 			atom.commands.add("atom-workspace", {
// 				"codestream:toggle": () => atom.workspace.toggle(CODESTREAM_VIEW_URI),
// 				"codestream:reset": () => {
// 					// db.delete();
// 					atom.commands.dispatch(document.querySelector("atom-workspace"), "codestream:logout");
// 					this.store.dispatch({ type: "RESET" });
// 					workspaceSession.logout();
// 					// atom.reload();
// 				}
// 			})
// 			// atom.config.observe("CodeStream", configs => {
// 			// 	store.dispatch(updateConfigs(configs));
// 			// }),
// 			// atom.config.observe("CodeStream.emailNotifications", setting => {
// 			// 	this.store.dispatch(setUserPreference(["emailNotifications"], setting ? "on" : "off"));
// 			// })
// 		);
//
// 		// Dev mode goodies
// 		const hiddenInCommandPalette = !atom.inDevMode();
// 		this.subscriptions.add(
// 			atom.commands.add("atom-workspace", "codestream:wipe-cache", {
// 				didDispatch: () => db.delete(),
// 				hiddenInCommandPalette
// 			}),
// 			atom.commands.add("atom-workspace", "codestream:point-to-dev", {
// 				didDispatch: () => {
// 					sessionStorage.setItem("codestream.env", "dev");
// 					sessionStorage.setItem("codestream.url", "https://pd-api.codestream.us:9443");
// 					this.store.dispatch(logout());
// 					atom.reload();
// 				},
// 				hiddenInCommandPalette
// 			}),
// 			atom.commands.add("atom-workspace", "codestream:point-to-local", {
// 				didDispatch: () => {
// 					sessionStorage.setItem("codestream.env", "local");
// 					sessionStorage.setItem("codestream.url", "https://localhost.codestream.us:12079");
// 					this.store.dispatch(logout());
// 					atom.reload();
// 				},
// 				hiddenInCommandPalette
// 			}),
// 			atom.commands.add("atom-workspace", "codestream:point-to-qa", {
// 				didDispatch: () => {
// 					sessionStorage.setItem("codestream.env", "qa");
// 					sessionStorage.setItem("codestream.url", "https://qa-api.codestream.us");
// 					this.store.dispatch(logout());
// 					atom.reload();
// 				},
// 				hiddenInCommandPalette
// 			}),
// 			atom.commands.add("atom-workspace", "codestream:point-to-production", {
// 				didDispatch: () => {
// 					sessionStorage.removeItem("codestream.env");
// 					sessionStorage.removeItem("codestream.url");
// 					this.store.dispatch(logout());
// 					atom.reload();
// 				},
// 				hiddenInCommandPalette
// 			}),
// 			atom.commands.add("atom-workspace", "codestream:which-environment?", {
// 				didDispatch: () => {
// 					const urlConfig = sessionStorage.getItem("codestream.url") || "production";
// 					atom.notifications.addInfo(`CodeStream is pointed to ${urlConfig}`, {
// 						dismissable: true
// 					});
// 				},
// 				hiddenInCommandPalette
// 			})
// 		);
// 	},
//
// 	deactivate() {
// 		this.subscriptions.dispose();
// 		if (this.statusBarTile) this.statusBarTile.destroy();
// 		this.store.dispatch(logout());
// 	},
//
// 	serialize() {
// 		return { workspaceSession: workspaceSession.serialize(), viewState: this.store.getState() };
// 	},
//
// 	deserializeCodestreamView() {
// 		this.view = new CodestreamView(this.store);
// 		return this.view;
// 	},
//
// 	// async setup() {
// 	// 	const directories = atom.project.getDirectories();
// 	// 	const repoPromises = directories.map(repo => atom.project.repositoryForDirectory(repo));
// 	// 	const allRepos = await Promise.all(repoPromises);
// 	// 	const repos = allRepos.filter(Boolean);
// 	//
// 	// 	if (repos.length === 1) {
// 	// 		const repo = repos[0];
// 	// 		getCurrentCommit(repo).then(commitHash => store.dispatch(setCurrentCommit(commitHash)));
// 	//
// 	// 		const updateCommitHash = async () => {
// 	// 			const { context } = store.getState();
// 	// 			const currentCommit = await getCurrentCommit(repo);
// 	// 			if (context.currentCommit !== currentCommit) {
// 	// 				await store.dispatch(calculateUncommittedMarkers());
// 	// 				store.dispatch(commitHashChanged(currentCommit));
// 	// 			}
// 	// 		};
// 	//
// 	// 		this.subscriptions.add(
// 	// 			atom.workspace.observeActiveTextEditor(editor => {
// 	// 				// Only dispatch the action if there is a current file that belongs to the git repo
// 	// 				// that way if a user looks at settings or a non-repo file,
// 	// 				// the stream for the last active repo file is still visible
// 	// 				if (editor) {
// 	// 					const directoryForFile = directories.find(directory =>
// 	// 						directory.contains(editor.getPath())
// 	// 					);
// 	// 					if (directoryForFile) {
// 	// 						atom.project.repositoryForDirectory(directoryForFile).then(repo => {
// 	// 							if (repo) {
// 	// 								let path = repo.relativize(editor.getPath());
// 	// 								// note we always maintain the current file with a forward slash separator
// 	// 								// even if we are on a Windows machine using a backslash
// 	// 								path = path.replace("\\", "/");
// 	// 								store.dispatch(setCurrentFile(path));
// 	// 							} else store.dispatch(setCurrentFile(null));
// 	// 						});
// 	// 					}
// 	// 				} else {
// 	// 					// in the case of no editor, for example the settings page,
// 	// 					// we display the "intro" welcome to codestream text, which
// 	// 					// is handled by lib/components/Stream.js when there is no file
// 	// 					store.dispatch(setCurrentFile(null));
// 	// 				}
// 	// 			}),
// 	//
// 	// 			// Subscribe to git status changes in order to be aware of current commit hash.
// 	// 			repo.onDidChangeStatuses(event => {
// 	// 				updateCommitHash();
// 	// 			})
// 	// 		);
// 	//
// 	// 		window.addEventListener("online", e => store.dispatch(online()), false);
// 	// 		window.addEventListener("offline", e => store.dispatch(offline()), false);
// 	// 		window.addEventListener("mousemove", e => store.dispatch(setActive()), false);
// 	// 		window.addEventListener("keypress", e => store.dispatch(setActive()), false);
// 	// 		window.addEventListener("focus", e => store.dispatch(setActive()), false);
// 	// 		window.addEventListener("blur", e => store.dispatch(setHasFocus(false)), false);
// 	// 		window.addEventListener("focus", e => store.dispatch(setHasFocus(true)), false);
// 	// 		store.dispatch(setHasFocus(true));
// 	//
// 	// 		const repoAttributes = store.getState().repoAttributes;
// 	// 		if (_.isEmpty(repoAttributes) || !repoAttributes.url) {
// 	// 			const workDir = repo.getWorkingDirectory();
// 	// 			try {
// 	// 				let knownCommitHashes = await getAllKnownCommits(workDir);
// 	// 				store.dispatch(
// 	// 					setRepoAttributes({
// 	// 						workingDirectory: workDir,
// 	// 						knownCommitHashes
// 	// 					})
// 	// 				);
// 	// 			} catch ({ missingGit, message }) {
// 	// 				if (missingGit) store.dispatch(noGit());
// 	// 				else
// 	// 					Raven.captureMessage(
// 	// 						"There was an unexpected error trying to get known commit hashes.",
// 	// 						{
// 	// 							level: "error",
// 	// 							logger: "codestream.js",
// 	// 							extra: { message }
// 	// 						}
// 	// 					);
// 	// 			}
// 	// 			GitRepo.open(workDir)
// 	// 				.listRemoteReferences()
// 	// 				.then(remotes => {
// 	// 					const uniqueRemotes = _.uniq(remotes, r => r.name);
// 	// 					if (uniqueRemotes.length === 0) store.dispatch(noRemoteUrl());
// 	// 					if (uniqueRemotes.length === 1) store.dispatch(setRepoUrl(uniqueRemotes[0].url));
// 	// 					else store.dispatch(foundMultipleRemotes(uniqueRemotes));
// 	// 				});
// 	// 		}
// 	// 	}
// 	// },
//
// 	consumeStatusBar(statusBar) {
// 		this.statusBar = statusBar;
// 		const div = document.createElement("div");
// 		div.classList.add("inline-block");
// 		const icon = document.createElement("span");
// 		icon.classList.add("icon", "icon-comment-discussion");
// 		icon.onclick = event =>
// 			atom.commands.dispatch(document.querySelector("atom-workspace"), "codestream:toggle");
// 		atom.tooltips.add(div, { title: "Toggle CodeStream" });
// 		div.appendChild(icon);
// 		this.statusBarTile = statusBar.addRightTile({ item: div, priority: 400 });
// 	}
// };
