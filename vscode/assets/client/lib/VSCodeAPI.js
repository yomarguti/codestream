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
	focusView() {},

	inDevMode() {
		return true;
	},

	readClipboard() {
		return "";
	},

	createCompositeDisposable() {
		return new CompositeDisposable();
	},

	addKeyMapping(source, bindings) {
		return { dispose() {} };
	},

	addCommands(target, commands) {
		return { dispose() {} };
	},

	getRepositories() {
		return [];
	},

	getActiveEditor() {
		return null;
	},

	openInBrowser(url) {},

	showNotification(message, { type = "info" } = {}) {
		// const types = ["info", "warning", "error", "success"]; // TODO: these could be enums, throw error if given type isn't valid
		const capitalize = string => string[0].toUpperCase() + string.substring(1);

		// atom.notifications[`add${capitalize(type)}`](message);
	},

	tooltips: false,
	reload: () => {}
};
