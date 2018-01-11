import { CompositeDisposable } from "atom";
import Dexie from "dexie";
import CodestreamView, { CODESTREAM_VIEW_URI } from "./codestream-view";
import { bootstrapStore } from "./local-cache";
import git from "./git";
import createStore from "./createStore";
import {
	commitHashChanged,
	fetchRepoInfo,
	logout,
	noAccess,
	setRepoAttributes,
	setContext,
	setCurrentFile,
	setCurrentCommit
} from "./actions/context";

let store;

const initializeStore = state => {
	const session = JSON.parse(localStorage.getItem("codestream.session")) || {};
	store = createStore({ ...state, session });
};

const getCurrentCommit = async repo => {
	const data = await git(["rev-parse", "--verify", "HEAD"], {
		cwd: repo.getWorkingDirectory()
	});
	return data.trim();
};

module.exports = {
	subscriptions: new CompositeDisposable(),
	config: {
		showHeadshots: {
			description: "Display headshots in the stream",
			type: "boolean",
			default: true
		}
	},

	initialize(state) {
		initializeStore(state);
		bootstrapStore(store);

		this.subscriptions.add(
			atom.packages.onDidActivateInitialPackages(async () => {
				const directories = atom.project.getDirectories();
				const repoPromises = directories.map(repo => atom.project.repositoryForDirectory(repo));
				const allRepos = await Promise.all(repoPromises);
				const repos = allRepos.filter(Boolean);

				if (repos.length > 0) {
					const repo = repos[0];
					getCurrentCommit(repo).then(commitHash => store.dispatch(setCurrentCommit(commitHash)));

					this.subscriptions.add(
						atom.workspace.observeActiveTextEditor(editor => {
							// Only dispatches the action if there is a current file
							// that way if a user looks at settings or a non-repo file, the stream for the previously active file is still visible
							const path = editor ? repo.relativize(editor.getPath()) : "";
							path !== "" && store.dispatch(setCurrentFile(path));
						}),

						// Subscribe to git status changes in order to be aware of current commit hash.
						// This is probably a naive implementation.
						repo.onDidChangeStatuses(async event => {
							const commitHash = await getCurrentCommit(repo);
							if (store.getState().context.currentCommit !== commitHash)
								store.dispatch(commitHashChanged(commitHash));
						})
					);

					const workDir = repo.repo.workingDirectory;
					const repoUrl = repo.getOriginURL();
					let firstCommitHash = await git(["rev-list", "--max-parents=0", "HEAD"], {
						cwd: repo.getWorkingDirectory()
					});
					const repoAttributes = { workingDirectory: workDir, url: repoUrl, firstCommitHash: firstCommitHash.trim() };
					store.dispatch(setRepoAttributes(repoAttributes));
					store.dispatch(fetchRepoInfo(repoAttributes));
				}
			})
		);
	},

	activate(state) {
		this.subscriptions.add(
			atom.workspace.addOpener(uri => {
				if (uri === CODESTREAM_VIEW_URI) {
					return new CodestreamView(store);
				}
			}),
			atom.commands.add("atom-workspace", {
				"codestream:toggle": () => atom.workspace.toggle(CODESTREAM_VIEW_URI),
				"codestream:logout": () => {
					store.dispatch(logout());
					localStorage.removeItem("codestream.session");
					localStorage.removeItem("codestream.accessToken");
				}
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
					"codestream:reset": async () => {
						atom.commands.dispatch(
							document.querySelector("atom-workspace"),
							"codestream:wipe-cache"
						);
						atom.commands.dispatch(document.querySelector("atom-workspace"), "codestream:logout");
						atom.reload();
					},
					"codestream:wipe-cache": () => indexedDB.deleteDatabase("CodeStream"),
					"codestream:point-to-dev": () => {
						atom.config.set("codestream.url", "https://tca3.codestream.us:9443");
						atom.reload();
					},
					"codestream:point-to-local": () => {
						atom.config.set("codestream.url", "https://localhost.codestream.us:12079");
						atom.reload();
					}
				})
			);
		}
	},

	deactivate() {
		this.subscriptions.dispose();
		if (this.statusBarTile) this.statusBarTile.destroy();
	},

	serialize() {
		const { session, onboarding, context } = store.getState();
		onboarding.errors = {};
		localStorage.setItem("codestream.session", JSON.stringify(session));
		return { onboarding, context };
	},

	deserializeCodestreamView(data) {
		return new CodestreamView(store);
	},

	consumeStatusBar(statusBar) {
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
