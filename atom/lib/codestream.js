import { CompositeDisposable } from "atom";
import createStore from "redux-zero";
import CodestreamView, { CODESTREAM_VIEW_URI } from "./codestream-view";
import { get } from "./network-request";
import git from "./git";

let store;

const syncStore = session => {
	if (store === undefined) {
		store = createStore(session);
	} else {
		store.setState(session);
	}
};

module.exports = {
	subscriptions: null,

	async initialize() {
		const directories = atom.project.getDirectories();
		const repoPromises = directories.map(repo => atom.project.repositoryForDirectory(repo));

		const allRepos = await Promise.all(repoPromises);
		const repos = allRepos.filter(Boolean);
		if (repos.length > 0) {
			const repo = repos[0];
			const repoUrl = repo.getOriginURL();
			const firstCommitHash = await git("rev-list --max-parents=0 HEAD", {
				cwd: repo.getWorkingDirectory()
			});
			const data = await get(
				`/no-auth/find-repo?url=${repoUrl}&firstCommitHash=${firstCommitHash}`
			);
			const session =
				Object.keys(data).length === 0
					? null
					: { repoMetadata: data.repo, team: { usernames: data.usernames } };
			syncStore(session);
		}
	},

	activate(state) {
		syncStore(state.session);
		this.subscriptions = new CompositeDisposable();
		this.subscriptions.add(
			atom.workspace.addOpener(uri => {
				if (uri === CODESTREAM_VIEW_URI) {
					return new CodestreamView(store);
				}
			}),
			atom.commands.add("atom-workspace", {
				"codestream:toggle": () => atom.workspace.toggle(CODESTREAM_VIEW_URI),
				"codestream:comment": () => atom.workspace.toggle(CODESTREAM_VIEW_URI)
			})
		);
	},

	deactivate() {
		this.subscriptions.dispose();
		if (this.statusBarTile) this.statusBarTile.destroy();
	},

	serialize() {
		return { session: store.getState() };
	},

	deserializeCodestreamView(serialized) {
		syncStore(serialized.session);
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
