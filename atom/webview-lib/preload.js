const { ipcRenderer } = require("electron");

class AtomApi {
	constructor(_ipc) {
		this._ipc = _ipc;
		this._webviewMessageListeners = [];
		this._harnessMessageListeners = [];

		this._ipc.on("harness", (e, message) => {
			this._harnessMessageListeners.forEach(l => {
				try {
					l(message);
				} catch (error) {}
			});
		});
		_ipc.on("codestream-ui", (e, message) => {
			this._webviewMessageListeners.forEach(l => {
				try {
					l(message);
				} catch (error) {}
			});
		});
	}

	onDidReceiveCSMessage(cb) {
		this._webviewMessageListeners.push(cb);
	}

	onDidReceiveHarnessMessage(cb) {
		this._harnessMessageListeners.push(cb);
	}

	sendHarnessMessage(message) {
		this._ipc.sendToHost("harness", message);
	}

	send(message) {
		this._ipc.sendToHost("codestream-ui", message);
	}
}

let api;

Object.defineProperty(window, "acquireAtomApi", {
	value: () => {
		if (!api) api = new AtomApi(ipcRenderer);
		return api;
	},
});
