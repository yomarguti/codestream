import { CompositeDisposable, Disposable } from "atom";
import { CodestreamView, CODESTREAM_VIEW_URI } from "./views/webview/codestream-view";
import { actions, createStore, HostApi } from "codestream-components";
import { StatusBar, Tile } from "./types/package-services/status-bar";
import { WorkspaceSession, SessionStatus } from "./workspace/workspace-session";
import { PackageState } from "./types/package";
import { WebviewIpc } from "./views/webview/ipc";
import { PD_CONFIG } from "./env-utils";

class CodestreamPackage {
	subscriptions = new CompositeDisposable();
	workspaceSession: WorkspaceSession;
	statusBar?: StatusBar;
	statusBarTile?: Tile;
	view?: CodestreamView;
	store: any;
	sessionStatusCommand?: Disposable;
	port: MessagePort;

	constructor(port: MessagePort, state: PackageState) {
		this.port = port;
		this.workspaceSession = WorkspaceSession.create(state);
		this.initialize();
	}

	// Package lifecyle 1
	async initialize() {
		this.store = createStore(this.workspaceSession.getBootstrapState(), { api: HostApi.instance });
		const bootstrapData = await this.workspaceSession.getBootstrapData();
		this.store.dispatch(actions.bootstrap(bootstrapData));

		this.workspaceSession.onDidChangeSessionStatus(status => {
			this.sessionStatusCommand && this.sessionStatusCommand.dispose();
			if (status === SessionStatus.SignedIn) {
				this.sessionStatusCommand = atom.commands.add(
					"atom-workspace",
					"codestream:sign-out",
					() => {
						this.workspaceSession!.signOut();
					}
				);
			}
			if (status === SessionStatus.SignedOut) {
				this.store.dispatch(actions.reset());
				this.sessionStatusCommand = atom.commands.add(
					"atom-workspace",
					"codestream:sign-in",
					() => {}
				);
			}
		});

		const hiddenInCommandPalette = !atom.inDevMode();
		this.subscriptions.add(
			atom.workspace.addOpener(uri => {
				if (uri === CODESTREAM_VIEW_URI) {
					if (this.view && this.view.alive) return this.view;
					this.view = new CodestreamView(this.workspaceSession, this.port, this.store);
					return this.view;
				}
			}),
			atom.commands.add("atom-workspace", "codestream:toggle", () =>
				atom.workspace.toggle(CODESTREAM_VIEW_URI)
			),
			// 		Dev mode goodies
			atom.commands.add("atom-workspace", "codestream:point-to-dev", {
				didDispatch: () => {
					this.workspaceSession.changeEnvironment(PD_CONFIG);
				},
				hiddenInCommandPalette,
			})
		);
	}

	// Package lifecyle
	deserializeCodestreamView() {
		this.view = new CodestreamView(this.workspaceSession, this.port, this.store);
		return this.view;
	}

	// Package lifecyle
	activate() {}

	// Package lifecyle
	serialize(): PackageState {
		return this.workspaceSession.serialize();
	}

	// Package lifecyle
	deactivate() {
		this.workspaceSession.dispose();
		this.subscriptions.dispose();
		if (this.statusBarTile) this.statusBarTile.destroy();
	}

	async consumeStatusBar(statusBar: StatusBar) {
		this.statusBar = statusBar;

		const messages = {
			[SessionStatus.SignedIn]: () => this.workspaceSession.user!.username,
			[SessionStatus.SigningIn]: () => "Signing in...",
			[SessionStatus.SignedOut]: () => "Sign in",
		};
		const tileRoot = document.createElement("div");
		tileRoot.classList.add("inline-block");
		tileRoot.onclick = event => {
			event.stopPropagation();
			atom.commands.dispatch(document.querySelector("atom-workspace")!, "codestream:toggle");
		};
		const icon = document.createElement("span");
		icon.classList.add("icon", "icon-comment-discussion");
		tileRoot.appendChild(icon);
		atom.tooltips.add(tileRoot, { title: "Toggle CodeStream" });
		const text = document.createElement("span");
		tileRoot.appendChild(text);

		this.workspaceSession!.onDidChangeSessionStatus(status => {
			text.innerText = messages[status]();

			if (!this.statusBarTile) {
				this.statusBarTile = statusBar.addRightTile({ item: tileRoot, priority: 400 });
			}
		});

		return new Disposable(() => {
			this.statusBar = undefined;
			if (this.statusBarTile) {
				this.statusBarTile.destroy();
				this.statusBarTile = undefined;
			}
		});
	}
}

const webviewIpc = new WebviewIpc();
Object.defineProperty(window, "acquireCodestreamHost", {
	value() {
		return webviewIpc.webview;
	},
});

let codestream;
const packageWrapper = {
	initialize(state: PackageState) {
		codestream = new CodestreamPackage(webviewIpc.host, state);
	},
};

export default new Proxy(packageWrapper, {
	get(target: any, name: any) {
		if (codestream && Reflect.has(codestream, name)) {
			let property = codestream[name];
			if (typeof property === "function") {
				property = property.bind(codestream);
			}
			return property;
		} else {
			return target[name];
		}
	},
});

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
// 	// async setup() {
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
// 	// },
// };
