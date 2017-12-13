import { CompositeDisposable } from "atom";
import CodestreamView, { CODESTREAM_VIEW_URI } from "./codestream-view";
import { bootstrapStore } from "./local-cache";
import { get } from "./network-request";
import git from "./git";
import createStore from "./createStore";
import {
	setRepoAttributes,
	setContext,
	setCurrentFile,
	setCurrentCommit,
	commitHashChanged,
	logout
} from "./actions/context";

// TODO: figure out if there's a better place for this
const session = JSON.parse(localStorage.getItem("codestream.session")) || {};
const store = createStore({ session });

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
		bootstrapStore(store);
		store.dispatch({ type: "LOAD_ONBOARDING", payload: state.onboarding });
		store.dispatch(setContext(state.context));

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
							const path = editor ? repo.relativize(editor.getPath()) : "";
							store.dispatch(setCurrentFile(path));
						}),

						repo.onDidChangeStatuses(async event => {
							const commitHash = await getCurrentCommit(repo);
							if (store.getState().context.currentCommit !== commitHash)
								store.dispatch(commitHashChanged(commitHash));
						})
					);

					const repoUrl = repo.getOriginURL();
					let firstCommitHash = await git(["rev-list", "--max-parents=0", "HEAD"], {
						cwd: repo.getWorkingDirectory()
					});
					firstCommitHash = firstCommitHash.trim();
					store.dispatch(setRepoAttributes({ url: repoUrl, firstCommitHash }));
					const data = await get(
						`/no-auth/find-repo?url=${repoUrl}&firstCommitHash=${firstCommitHash}`
					);
					if (Object.keys(data).length > 0) {
						store.dispatch(
							setContext({
								usernamesInTeam: data.usernames,
								currentRepoId: data.repo._id,
								currentTeamId: data.repo.teamId
							})
						);
					}
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
				},
				"codestream:wipe-cache": () => indexedDB.deleteDatabase("CodeStream")
			})
			// atom.commands.add(".codestream .compose.mentions-on", {
			// 	"codestream:at-mention-move-up": event => this.handleAtMentionKeyPress(event, "up"),
			// 	"codestream:at-mention-move-down": event => this.handleAtMentionKeyPress(event, "down"),
			// 	"codestream:at-mention-escape": event => this.handleAtMentionKeyPress(event, "escape")
			// })
		);
	},

	deactivate() {
		this.subscriptions.dispose();
		if (this.statusBarTile) this.statusBarTile.destroy();
	},

	serialize() {
		const { session, onboarding, context } = store.getState();
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
