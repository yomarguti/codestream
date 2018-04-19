import { shell } from "electron";
import { CODESTREAM_VIEW_URI } from "./codestream-view";
import Blamer from "./util/blamer";
import git from "./git";

class CompositeDisposable {
	disposables = [];
	isDisposed = false;

	add(...newDisposables) {
		this.disposables.push(...newDisposables);
	}

	dispose() {
		this.disposables.forEach(disposable => disposable.dispose());
		this.isDisposed = true;
	}
}

export default {
	isAtom: true,

	focusView() {
		atom.workspace.open(CODESTREAM_VIEW_URI);
	},

	inDevMode() {
		return atom.inDevMode();
	},

	readClipboard() {
		return atom.clipboard.read();
	},

	writeToClipboard(content) {
		atom.clipboard.write(content);
	},

	getRepositories() {
		return Promise.all(
			atom.project.getDirectories().map(atom.project.repositoryForDirectory.bind(atom.project))
		).then(results => results.filter(Boolean));
	},

	openInBrowser(url) {
		shell.openExternal(url);
	},

	showNotification(message, { type = "info" } = {}) {
		// const types = ["info", "warning", "error", "success"]; // TODO: these could be enums, throw error if given type isn't valid
		const capitalize = string => string[0].toUpperCase() + string.substring(1);

		atom.notifications[`add${capitalize(type)}`](message);
	},

	createCompositeDisposable() {
		return new CompositeDisposable();
	},

	addKeyMapping(source, bindings) {
		return atom.keymaps.add(source, bindings);
	},

	addCommands(target, commands) {
		return atom.commands.add(target, commands);
	},

	getActiveEditor() {
		return atom.workspace.getCenter().getActiveTextEditor();
	},

	confirm(options) {
		return atom.confirm(options);
	},

	focusOnEditor() {
		atom.workspace.getCenter().activate();
	},

	git: {
		blame(filePath) {
			return new Promise((resolve, reject) => {
				const directory = atom.project
					.getDirectories()
					.find(directory => directory.contains(filePath));

				if (!directory) reject();
				else {
					atom.project
						.repositoryForDirectory(directory)
						.then(repo => {
							if (repo)
								new Blamer(repo).blame(filePath, (err, data) => {
									if (!err) resolve(data);
									else reject();
								});
							else reject();
						})
						.catch(reject);
				}
			});
		},

		run: git
	},

	tooltips: atom.tooltips,
	reload: atom.reload.bind(atom)
};
