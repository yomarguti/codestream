import Raven from "raven-js";
import { normalize } from "./utils";
import {
	setContext,
	setCurrentRepo,
	setCurrentTeam,
	setRemote,
	noAccess,
	noRemoteUrl
} from "./context";
import { saveUser, saveUsers, ensureCorrectTimeZone } from "./user";
import { saveRepo, saveRepos } from "./repo";
import { fetchCompanies, saveCompany } from "./company";
import { fetchTeamMembers, saveTeam, saveTeams, joinTeam as _joinTeam } from "./team";
import { fetchStreams } from "./stream";
import { fetchLatestForCurrentStream } from "./post";
import UUID from "uuid/v1";

const logError = (message, error, extra = {}) => {
	Raven.captureException(error, { logger: "actions/onboarding", extra });
	console.error(message, error);
};

const requestStarted = () => ({ type: "REQUEST_STARTED" });
const requestFinished = () => ({ type: "REQUEST_FINISHED" });
const serverUnreachable = () => ({ type: "ONBOARDING-SERVER_UNREACHABLE" });
const invalidCredentials = () => ({ type: "INVALID_CREDENTIALS" });
const loggedIn = () => ({ type: "LOGGED_IN" });
const usernameCollision = (takenUsername, nextAction) => ({
	type: "USERNAME_COLLISION_ON_TEAM",
	payload: { takenUsername, nextAction }
});

const userAlreadySignedUp = email => ({
	type: "SIGNUP_EMAIL_EXISTS",
	payload: { email, alreadySignedUp: true }
});

const initializeSession = payload => ({
	type: "INIT_SESSION",
	payload
});

const fetchRepoInfo = ({ url, firstCommitHash }) => async (dispatch, getState, { http }) => {
	if (!url) {
		Raven.captureMessage("No url found while trying to fetch repository information.", {
			logger: "actions/onboarding",
			extra: { url, firstCommitHash }
		});
		return dispatch(noRemoteUrl());
	}
	try {
		const { repo, usernames } = await http.get(
			`/no-auth/find-repo?url=${encodeURIComponent(url)}&firstCommitHash=${firstCommitHash}`
		);

		if (repo) {
			return {
				usernamesInTeam: usernames,
				currentRepoId: repo._id,
				currentTeamId: repo.teamId,
				noAccess: false
			};
		}
	} catch (error) {
		if (http.isApiRequestError(error)) {
			if (error.data.code === "REPO-1000") dispatch(noAccess());
			if (error.data.code === "UNKNOWN") dispatch(noAccess());
		} else if (http.isApiUnreachableError(error)) dispatch(serverUnreachable());
		else
			logError("encountered unexpected error while fetching repo information", error, {
				url,
				firstCommitHash
			});
		throw new Error("Unable to get repo information"); // TODO: tell the user exactly what's wrong
	}
};

export const completeOnboarding = () => ({ type: "ONBOARDING_COMPLETE" });
export const goToSignup = () => ({ type: "GO_TO_SIGNUP" });
export const goToLogin = () => ({ type: "GO_TO_LOGIN" });
export const goToConfirmation = attributes => ({ type: "GO_TO_CONFIRMATION", payload: attributes });
export const foundMultipleRemotes = remotes => ({
	type: "FOUND_MULTIPLE_REMOTES",
	payload: { remotes }
});

export const selectRemote = url => dispatch => {
	dispatch({
		type: "SET_REPO_URL",
		payload: url
	});
	dispatch({ type: "SELECTED_REMOTE" });
};

export const register = attributes => async (dispatch, getState, { http }) => {
	const { repoAttributes } = getState();

	try {
		const repoInfo = await dispatch(fetchRepoInfo(repoAttributes));
		if (repoInfo) {
			dispatch(setContext(repoInfo));
			if (repoInfo.usernamesInTeam.includes(attributes.username))
				return dispatch({ type: "SIGNUP-USERNAME_COLLISION" });
		}
	} catch (error) {
		return;
	}

	return http
		.post("/no-auth/register", attributes)
		.then(async ({ user }) => {
			user = normalize(user);
			dispatch({ type: "SIGNUP_SUCCESS", payload: { ...attributes, userId: user.id }, meta: user });
			await dispatch(saveUser(user));
		})
		.catch(error => {
			if (http.isApiRequestError(error)) {
				if (error.data.code === "RAPI-1004") dispatch(userAlreadySignedUp(attributes.email));
			}
			if (http.isApiUnreachableError(error)) dispatch(serverUnreachable());
		});
};

export const confirmEmail = attributes => (dispatch, getState, { http }) => {
	dispatch(requestStarted());
	return http
		.post("/no-auth/confirm", attributes)
		.then(async ({ accessToken, user, teams, repos, pubnubKey }) => {
			dispatch(requestFinished());
			user = normalize(user);

			const { context, repoAttributes } = getState();
			let teamIdForRepo = context.currentTeamId;
			if (!teamIdForRepo) {
				// fetch repo info again just in case a team has been created since CS was initialized
				try {
					const repoInfo = await dispatch(fetchRepoInfo(repoAttributes));
					if (repoInfo) {
						dispatch(setContext(repoInfo));
						teamIdForRepo = repoInfo.currentTeamId;
					}
				} catch (error) {
					return;
				}
			}
			const userTeams = normalize(teams);
			const userRepos = normalize(repos);

			const teamIdsForUser = user.teamIds || userTeams.map(team => team.id);

			// TODO: handle db error - maybe continue updating the view?
			await saveUser(user);
			await dispatch(saveTeams(userTeams));
			await dispatch(saveRepos(userRepos));
			const sessionId = UUID();
			await dispatch(
				initializeSession({
					userId: user.id,
					accessToken,
					sessionId,
					pubnubSubscribeKey: pubnubKey
				})
			);

			let alreadyOnTeam = false;

			if (!teamIdForRepo && userTeams.length === 0) {
				dispatch({ type: "NEW_USER_CONFIRMED_IN_NEW_REPO" });
			} else if (!teamIdForRepo && userTeams.length > 0) {
				await dispatch(fetchTeamMembers(teamIdsForUser));
				dispatch({ type: "EXISTING_USER_CONFIRMED_IN_NEW_REPO" });
			} else if (teamIdsForUser.includes(teamIdForRepo)) {
				alreadyOnTeam = true;
				await dispatch(fetchTeamMembers(teamIdsForUser));
				dispatch(fetchCompanies(userTeams.map(t => t.companyId)));
				dispatch(fetchStreams());
				dispatch({ type: "EXISTING_USER_CONFIRMED" });
			} else await dispatch(joinTeam("EXISTING_USER_CONFIRMED"));

			dispatch({ type: "USER_CONFIRMED", meta: { alreadyOnTeam } });
		})
		.catch(error => {
			dispatch(requestFinished());
			if (http.isApiRequestError(error)) {
				const { data } = error;
				if (data.code === "USRC-1002") dispatch({ type: "INVALID_CONFIRMATION_CODE" });
				if (data.code === "USRC-1003") dispatch({ type: "EXPIRED_CONFIRMATION_CODE" });
				if (data.code === "USRC-1004") dispatch(goToSignup());
				if (data.code === "USRC-1006")
					dispatch({
						type: "USER_ALREADY_CONFIRMED",
						payload: { alreadyConfirmed: true, email: attributes.email }
					});
				if (data.code === "REPO-1000") dispatch(noAccess());
			} else if (http.isApiUnreachableError(error)) dispatch(serverUnreachable());
			else logError("Encountered an unexpected error while confirming email address", error);
		});
};

export const sendNewCode = attributes => (dispatch, getState, { http }) => {
	return http.post("/no-auth/register", attributes).catch(error => {
		if (http.isApiRequestError(error) && error.data.code === "RAPI-1004") return true;
		if (http.isApiUnreachableError(error)) dispatch(serverUnreachable());
	});
};

export const createTeam = name => (dispatch, getState, { http }) => {
	const { session, repoAttributes } = getState();
	const params = {
		url: repoAttributes.url,
		firstCommitHash: repoAttributes.firstCommitHash,
		team: { name }
	};
	dispatch(requestStarted());
	return http
		.post("/repos", params, session.accessToken)
		.then(async data => {
			dispatch(requestFinished());
			const company = normalize(data.company);
			const team = normalize(data.team);
			const repo = normalize(data.repo);
			const users = normalize(data.users);

			await dispatch(saveCompany(company));
			await dispatch(saveRepo(repo));
			await dispatch(saveTeam(team));
			await dispatch(saveUsers(users));

			dispatch(setCurrentTeam(team.id));
			dispatch(setCurrentRepo(repo.id));

			dispatch({ type: "TEAM_CREATED", payload: { teamId: team.id } });
		})
		.catch(error => {
			dispatch(requestFinished());
			if (http.isApiRequestError(error)) {
				if (error.data.code === "RAPI-1005") dispatch({ type: "CREATE_TEAM-INVALID_REPO_URL" });
			} else if (http.isApiUnreachableError(error)) dispatch(serverUnreachable());
			else logError("Encountered an unexpected error while creating team", error);
		});
};

export const addRepoForTeam = teamId => (dispatch, getState, { http }) => {
	const { repoAttributes, session, teams } = getState();
	const params = { ...repoAttributes, teamId };
	dispatch(requestStarted());
	http
		.post("/repos", params, session.accessToken)
		.then(async data => {
			const repo = normalize(data.repo);
			dispatch(requestFinished());
			await dispatch(saveRepo(repo));
			dispatch(setCurrentRepo(repo.id));
			dispatch(setCurrentTeam(teamId));
			dispatch({ type: "REPO_ADDED_FOR_TEAM", payload: teams[teamId].name });
		})
		.catch(error => {
			dispatch(requestFinished());
			if (http.isApiRequestError(error)) {
				if (error.data.code === "RAPI-1003") dispatch(teamNotFound());
				if (error.data.code === "RAPI-1011") dispatch(noPermission());
			} else if (http.isApiUnreachableError(error)) {
				dispatch(serverUnreachable());
			}
		});
};

export const teamNotFound = () => ({ type: "TEAM_NOT_FOUND" });
export const noPermission = () => ({ type: "INVALID_PERMISSION_FOR_TEAM" });

export const addMembers = people => (dispatch, getState, { http }) => {
	const { repoAttributes, currentTeamId, session } = getState();
	const params = { ...repoAttributes, teamId: currentTeamId, users: people };
	return http
		.post("/repos", params, session.accessToken)
		.then(({ users, team, repo, company }) => {
			dispatch(saveUsers(normalize(users)));
			dispatch(saveTeam(normalize(team)));
			dispatch(saveRepo(normalize(repo)));
			dispatch(completeOnboarding());
		})
		.catch(error => {
			if (http.isApiRequestError(error)) {
				if (error.data.code === "RAPI-1003") dispatch(teamNotFound());
				if (error.data.code === "RAPI-1011") dispatch(noPermission());
			} else if (http.isApiUnreachableError(error)) {
				dispatch(serverUnreachable());
			}
		});
};

export const authenticate = params => (dispatch, getState, { http }) => {
	dispatch(requestStarted());
	return http
		.put("/no-auth/login", params)
		.then(async ({ accessToken, user, teams, repos, pubnubKey }) => {
			user = normalize(user);

			if (!user.isRegistered)
				return dispatch(
					goToConfirmation({
						userId: user.id,
						username: user.username,
						email: user.email,
						password: params.password,
						firstName: user.firstName || "",
						lastName: user.lastName || ""
					})
				);

			const userTeams = normalize(teams);
			repos = normalize(repos);
			await dispatch(saveUser(user));
			await dispatch(saveTeams(userTeams));
			await dispatch(saveRepos(repos));

			const { context, repoAttributes } = getState();

			const teamIdsForUser = user.teamIds || userTeams.map(team => team.id);

			const sessionId = UUID();
			dispatch(
				initializeSession({
					accessToken,
					userId: user.id,
					sessionId,
					pubnubSubscribeKey: pubnubKey
				})
			);
			// ensure the user's timezone is correctly saved in case they have moved
			// since last login
			dispatch(ensureCorrectTimeZone());

			let teamIdForRepo = context.currentTeamId;
			if (!teamIdForRepo) {
				// fetch repo info again just in case a team has been created since CS was initialized
				try {
					const repoInfo = await dispatch(fetchRepoInfo(repoAttributes));
					if (repoInfo) {
						dispatch(setContext(repoInfo));
						teamIdForRepo = repoInfo.currentTeamId;
					}
				} catch (error) {
					return dispatch(requestFinished());
				}
			}

			if (!teamIdForRepo && userTeams.length === 0)
				dispatch({ type: "NEW_USER_LOGGED_INTO_NEW_REPO" });
			else if (!teamIdForRepo && userTeams.length > 0) {
				await dispatch(fetchTeamMembers(teamIdsForUser));
				dispatch({ type: "EXISTING_USER_LOGGED_INTO_NEW_REPO" });
			} else if (teamIdsForUser.includes(teamIdForRepo)) {
				dispatch(fetchCompanies(userTeams.map(t => t.companyId)));
				await dispatch(fetchTeamMembers(teamIdsForUser));
				dispatch(fetchLatestForCurrentStream());
				dispatch(loggedIn());
			} else await dispatch(joinTeam(loggedIn().type));
			dispatch(requestFinished());
		})
		.catch(error => {
			dispatch(requestFinished());
			if (http.isApiRequestError(error)) {
				if (error.data.code === "USRC-1000") dispatch(serverUnreachable());
				if (error.data.code === "USRC-1001") dispatch(invalidCredentials());
				if (error.data.code === "RAPI-1003") dispatch(invalidCredentials());
				if (error.data.code === "REPO-1000") dispatch(noAccess());
				if (error.data.code === "RAPI-1005") dispatch(noAccess()); // TODO: How to handle url invalid here? Just bailing and saying no access for url invalid
			} else if (http.isApiUnreachableError(error)) dispatch(serverUnreachable());
			else logError("Encountered unexpected error while authenticating", error);
		});
};

export const joinTeam = nextAction => (dispatch, getState, { http }) => {
	return dispatch(_joinTeam())
		.then(() => {
			dispatch({ type: nextAction });
			dispatch(fetchStreams());
		})
		.catch(error => {
			if (http.isApiRequestError(error)) {
				if (error.data.code === "TEAM-1000")
					dispatch(usernameCollision(error.data.info, nextAction));
			}
		});
};

export const changeUsername = username => (dispatch, getState, { http }) => {
	return http
		.put("/users/me", { username }, getState().session.accessToken)
		.then(data => dispatch(saveUser(normalize(data.user))));
};
