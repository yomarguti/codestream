import mixpanel from "mixpanel-browser";
import { getPost } from "./reducers/posts";

mixpanel.init("4308967c7435e61d9697ce240bc68d02");

const accessSafely = func => {
	try {
		return func();
	} catch (error) {
		return undefined;
	}
};

export default store => {
	const isOptedIn = currentUser => {
		const { session, users } = store.getState();

		if (currentUser) return accessSafely(() => currentUser.preferences.telemetryConsent);
		if (session.userId) {
			const user = users[session.userId];
			return accessSafely(() => user.preferences.telemetryConsent);
		} else return false;
	};

	const registerSuperProperties = ({ currentUser, currentTeam, firstTimeUser = false }) => {
		const { companies, users, teams } = store.getState();
		if (typeof currentUser === "string") {
			currentUser = users[currentUser];
		}
		if (typeof currentTeam === "string") {
			currentTeam = teams[currentTeam];
		}
		const currentCompany = currentTeam && companies[currentTeam.companyId];

		mixpanel.register({
			"Email Address": currentUser.email,
			Endpoint: "Atom",
			"First Time User?": firstTimeUser,
			Plan: "Free",
			"Team ID": currentTeam ? currentTeam.id : undefined,
			"Team Size": currentTeam ? currentTeam.memberIds.length : undefined,
			Company: currentCompany ? currentCompany.name : undefined,
			"Plugin Version": accessSafely(
				() => atom.packages.getLoadedPackage("CodeStream").metadata.version
			)
		});
	};

	return next => action => {
		const oldState = store.getState();
		const result = next(action);

		// Once data has been loaded from indexedDB
		if (action.type === "BOOTSTRAP_COMPLETE") {
			const { context, session, onboarding } = store.getState();
			//if continuing a session,
			if (onboarding.complete && session.accessToken) {
				if (isOptedIn()) {
					mixpanel.identify(session.userId);
					registerSuperProperties({
						currentUser: session.userId,
						currentTeam: context.currentTeamId
					});
					if (context.currentFile) mixpanel.track("Page Viewed", { "Page Name": "Source Stream" });
				}
			} else if (onboarding.step === "signUp") {
				mixpanel.track("Page Viewed", { "Page Name": "Sign Up" });
			}
		}

		if (action.type === "GO_TO_SIGNUP") mixpanel.track("Page Viewed", { "Page Name": "Sign Up" });

		if (action.type === "SIGNUP_SUCCESS") {
			const currentUser = action.meta;
			if (isOptedIn(currentUser)) {
				const { context } = store.getState();

				if (currentUser.totalPosts && currentUser.totalPosts > 0) mixpanel.identify(currentUser.id);
				else mixpanel.alias(currentUser.id);

				mixpanel.register_once({
					"Date Signed Up": new Date(currentUser.createdAt).toISOString()
				});
				registerSuperProperties({
					currentUser,
					currentTeam: context.currentTeamId,
					firstTimeUser: true
				});
				mixpanel.track("Sign Up Success");
			}
		}

		if (isOptedIn()) {
			if (action.type === "USER_CONFIRMED")
				mixpanel.track("Email Confirmed", {
					"SignUp Type": action.meta.alreadyOnTeam ? "Viral" : "Organic"
				});

			if (action.type === "EXISTING_USER_LOGGED_INTO_NEW_REPO") {
				const { session, users } = store.getState();
				mixpanel.identify(session.userId);
				registerSuperProperties({ currentUser: users[session.userId] });
				mixpanel.track("Signed In");
			}
			if (action.type === "LOGGED_IN") {
				const { context, session, teams, users } = store.getState();
				const currentUser = users[session.userId];
				const currentTeam = context.currentTeamId && teams[context.currentTeamId];
				mixpanel.identify(session.userId);
				registerSuperProperties({ currentUser, currentTeam });
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
					"First Post?":
						Boolean(currentUser.totalPosts) === false
							? new Date(post.createdAt).toISOString()
							: null,
					Type: type
				});
			}

			if (action.type === "MARKER_CLICKED") {
				const { posts, session } = store.getState();
				const { postId, streamId } = action.meta;
				mixpanel.track("Marker Clicked", {
					"Orginal Author?": getPost(posts, streamId, postId).creatorId === session.userId
				});
			}

			if (action.type === "USERS-UPDATE_FROM_PUBNUB") {
				if (action.payload.joinMethod)
					mixpanel.register({ "Join Method": action.payload.joinMethod });
			}

			if (action.type === "TEAMS-UPDATE_FROM_PUBNUB") {
				mixpanel.register({ "Team Size": action.payload.memberIds.length });
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
				const { companies, teams } = store.getState();
				const currentTeam = teams[action.payload.teamId];
				const currentCompany = companies[currentTeam.companyId];
				mixpanel.register({
					"Team ID": action.payload.teamId,
					"Team Size": currentTeam.memberIds.length,
					Company: currentCompany.name
				});
			}
			if (action.type === "SET_CURRENT_TEAM") {
				const { companies, teams } = store.getState();
				const currentTeam = teams[action.payload];
				const currentCompany = companies[currentTeam.companyId];
				mixpanel.register({ "Team ID": action.payload, "Team Size": currentTeam.memberIds.length });
			}
			if (action.type === "SET_CURRENT_FILE") {
				if (action.payload && action.payload !== oldState.context.currentFile)
					mixpanel.track("Page Viewed", { "Page Name": "Source Stream" });
			}
		}

		return result;
	};
};
