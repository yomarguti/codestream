import mixpanel from "mixpanel-browser";
import git from "./git";

mixpanel.init("4308967c7435e61d9697ce240bc68d02");

const pluginVersion = atom.packages.getLoadedPackage("CodeStream").metadata.version;

export default store => next => action => {
	const result = next(action);

	const isOptedIn = currentUser => {
		const { session, users } = store.getState();

		if (currentUser) return currentUser.preferences.telemetryConsent;
		if (session.userId) {
			const user = users[session.userId];
			if (user.preferences.telemetryConsent) return true;
		} else return false;
	};

	// Once data has been loaded from indexedDB, if continuing a session,
	if (action.type === "BOOTSTRAP_COMPLETE") {
		const { session, onboarding } = store.getState();
		if (onboarding.complete && session.accessToken) {
			if (isOptedIn()) mixpanel.identify(session.userId);
		}
	}

	if (action.type === "SIGNUP_SUCCESS") {
		const user = action.meta;
		if (isOptedIn(user)) {
			const { teams, context } = store.getState();
			const currentTeam = context.currentTeamId && teams[context.currentTeamId];
			mixpanel.alias(user.id);
			mixpanel.register_once({
				"Date Signed Up": new Date(user.createdAt).toISOString()
			});
			mixpanel.register({
				"Email Address": user.email,
				Endpoint: "Atom",
				"First Time User?": true,
				Plan: "Free",
				"Team Size": currentTeam ? currentTeam.memberIds.length : undefined,
				"Plugin Version": pluginVersion
			});
			mixpanel.track("Sign Up Success");
		}
	}

	if (isOptedIn()) {
		if (action.type === "USER_CONFIRMED")
			mixpanel.track("Email Confirmed", {
				"SignUp Type": action.meta.alreadyOnTeam ? "Viral" : "Organic"
			});

		if (action.type === "LOGGED_IN") {
			const { context, session, teams, users } = store.getState();
			const currentUser = users[session.userId];
			const currentTeam = context.currentTeamId && teams[context.currentTeamId];
			mixpanel.identify(session.userId);
			mixpanel.register({
				"Email Address": currentUser.email,
				Endpoint: "Atom",
				"First Time User?": false,
				Plan: "Free",
				"Team Size": currentTeam ? currentTeam.memberIds.length : undefined,
				"Plugin Version": pluginVersion
			});
			mixpanel.track("Signed In");
		}

		if (action.type.includes("USERNAME_COLLISION")) {
			mixpanel.track("Username Collision");
		}

		if (action.type === "POST_CREATED") {
			const { post, ...extra } = action.meta;
			const currentUser = store.getState().users[post.creatorId];

			let type;
			if (post.codeBlocks.length === 0) type = "Chat";
			else type = post.codeBlocks[0].code.length > 0 ? "Code Quote" : "Code Location";

			mixpanel.track("Post Created", {
				Endpoint: "Atom",
				Thread: post.parentPostId ? "Reply" : "Parent",
				Category: "Source File",
				"Auto Mentions": extra.autoMentions.some(mention => post.text.includes(mention)),
				"First Post?": Boolean(currentUser.totalPosts) === false,
				Type: type
			});
		}

		if (action.type === "MARKER_CLICKED") {
			const { context, repoAttributes, session, users } = store.getState();
			const currentUser = users[session.userId];
			git(`log --reverse --format=%ae ${context.currentFile}`.split(" "), {
				cwd: repoAttributes.workingDirectory
			}).then(emails => {
				const originalAuthorEmail = emails.split("\n")[0];
				mixpanel.track("Marker Clicked", {
					"Orginal Author?": currentUser.email === originalAuthorEmail
				});
			});
		}

		if (action.type === "USERS-UPDATE_FROM_PUBNUB") {
			if (action.payload.joinMethod)
				mixpanel.register({ "Join Method": action.payload.joinMethod });
		}

		if (action.type === "SET_CONTEXT" && action.payload.currentTeamId) {
			const { teams } = store.getState();
			const currentTeam = teams[action.payload.currentTeamId];
			if (currentTeam)
				mixpanel.register({
					"Team ID": action.payload.currentRepoId,
					"Team Size": currentTeam.length
				});
		}
		if (action.type === "TEAM_CREATED") {
			const { teams } = store.getState();
			const currentTeam = teams[action.payload.teamId];
			mixpanel.register({
				"Team ID": action.payload.teamId,
				"Team Size": currentTeam.memberIds.length
			});
		}
		if (action.type === "SET_CURRENT_TEAM") {
			const { teams } = store.getState();
			const currentTeam = teams[action.payload];
			mixpanel.register({ "Team ID": action.payload, "Team Size": currentTeam.memberIds.length });
		}
	}

	return result;
};
