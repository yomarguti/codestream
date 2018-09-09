// @flow
// import AddCommentPopupManager from "./add-comment-popup-manager";
// import BufferChangeTracker from "./buffer-change-tracker";
// import DiffManager from "./diff-manager";
// import ContentHighlighter from "./content-highlighter";
// import MarkerLocationTracker from "./marker-location-tracker";
// import EditTracker from "./edit-tracker";
import CodeStreamApi from "../codestream-api";
import ViewApi from "./view-api";
import Agent from "./agent";

type Session = {
	user: { [key: string]: any },
	teamIds: string[],
	accessToken: string
};

export default class WorkspaceSession {
	viewApi: ViewApi;
	api: CodeStreamApi;
	session: ?Session;

	constructor(session: ?Session) {
		this.api = new CodeStreamApi();
		this.viewApi = new ViewApi(this);
		if (session) {
			this.session = session;
			this.api.setAccessToken(session.accessToken);
		}
		// this.popupManager = new AddCommentPopupManager(repoAttributes.workingDirectory);
		// this.bufferChangeTracker = new BufferChangeTracker(this.store, repoAttributes.workingDirectory);
		// this.diffManager = new DiffManager(this.store);
		// this.contentHighlighter = new ContentHighlighter(this.store);
		// this.markerLocationTracker = new MarkerLocationTracker(this.store);
		// this.editTracker = new EditTracker(this.store);
		// this.setupListeners();
		// this.initialized = true;
	}

	// setupListeners() {
	// 	this.subscriptions.add(
	// 		EventEmitter.on("interaction:clicked-link", link => shell.openExternal(link)),
	// 		EventEmitter.on("analytics", ({ label, payload }) => mixpanel.track(label, payload)),
	// 		EventEmitter.on("request", this.handleWebviewRequest)
	// 	);
	// }

	getUserId() {
		return this.session.user.id;
	}

	getCurrentTeamId() {
		return this.session.teamIds[0];
	}

	getTeams() {
		return this.api.getTeams();
	}

	getStreams() {
		return this.api.getStreams(this.getCurrentTeamId());
	}

	getUsers() {
		return this.api.getUsers([this.getCurrentTeamId()]);
	}

	getPosts(streamId: string, teamId: string) {
		return this.api.getPosts(streamId, teamId);
	}

	async login(email: string, password: string) {
		const agent = new Agent();
		agent.login(email, password);
		const result = await this.api.authenticate(email, password);
		this.session = {
			user: result.user,
			teamIds: result.user.teamIds,
			accessToken: result.accessToken
		};
		this.api.setAccessToken(result.accessToken);
		// TODO: setup pubnub
		// TODO: register logout command?
		// TODO: start presence tracking
		return true;
	}

	logout() {
		this.session = undefined;
		this.api = new CodeStreamApi();
	}

	handleWebviewRequest = ({ id, action, params }) => {
		switch (action) {
			case "create-post": {
				return this.api
					.createPost(
						params.id,
						params.streamId,
						params.parentPostId,
						params.text,
						params.codeBlocks,
						params.mentions,
						params.extra
					)
					.then(post => {
						window.parent.postMessage(
							{ type: "codestream:response", body: { id, action, payload: post } },
							"*"
						);
					})
					.catch(error => {
						window.parent.postMessage(
							{ type: "codestream:response", body: { id, action, error } },
							"*"
						);
					});
			}
			case "edit-post": {
				return this.api
					.editPost(params.id, params.text, params.mentions)
					.then(post => {
						window.parent.postMessage(
							{ type: "codestream:response", body: { id, action, payload: post } },
							"*"
						);
					})
					.catch(error => {
						window.parent.postMessage(
							{ type: "codestream:response", body: { id, action, error } },
							"*"
						);
					});
			}
			case "delete-post": {
				return this.api
					.deletePost(params)
					.then(post => {
						window.parent.postMessage(
							{ type: "codestream:response", body: { id, action, payload: post } },
							"*"
						);
					})
					.catch(error => {
						window.parent.postMessage(
							{ type: "codestream:response", body: { id, action, error } },
							"*"
						);
					});
			}
			case "create-stream": {
				return this.api
					.createStream(params)
					.then(stream => {
						window.parent.postMessage(
							{ type: "codestream:response", body: { id, action, payload: stream } },
							"*"
						);
					})
					.catch(error => {
						window.parent.postMessage(
							{ type: "codestream:response", body: { id, action, error } },
							"*"
						);
					});
			}
			case "update-stream": {
				return this.api
					.updateStream(params)
					.then(stream => {
						window.parent.postMessage(
							{ type: "codestream:response", body: { id, action, payload: stream } },
							"*"
						);
					})
					.catch(error => {
						window.parent.postMessage(
							{ type: "codestream:response", body: { id, action, error } },
							"*"
						);
					});
			}
			case "mark-stream-read": {
				return this.api.markStreamRead(params).then(() => {
					window.parent.postMessage(
						{ type: "codestream:response", body: { id, action, payload: {} } },
						"*"
					);
				});
				// .catch(e => {
				// /* doesn't really matter */
				// });
			}
			case "mark-post-unread": {
				return this.api.markPostUnread(params).then(() => {
					window.parent.postMessage(
						{ type: "codestream:response", body: { id, action, payload: {} } },
						"*"
					);
				});
				// .catch(e => {
				// /* doesn't really matter */
				// });
			}
			case "join-stream": {
				return this.api
					.joinStream(params)
					.then(stream => {
						window.parent.postMessage(
							{ type: "codestream:response", body: { id, action, payload: stream } },
							"*"
						);
					})
					.catch(error => {
						window.parent.postMessage(
							{ type: "codestream:response", body: { id, action, error } },
							"*"
						);
					});
			}
			case "save-user-preference": {
				return this.api.saveUserPreference(params).then(() => {
					window.parent.postMessage(
						{ type: "codestream:response", body: { id, action, payload: {} } },
						"*"
					);
				});
			}
			case "invite": {
				return this.api.invite(params).then(() => {
					window.parent.postMessage(
						{ type: "codestream:response", body: { id, action, payload: {} } },
						"*"
					);
				});
			}
		}
	};

	serialize() {
		return this.session;
	}
}
