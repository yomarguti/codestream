import { get, post, put } from "../network-request";
import { normalize } from "./utils";
import { setCurrentRepo, setCurrentTeam } from "./context";
import db from "../local-cache";

const requestStarted = () => ({ type: "REQUEST_STARTED" });
const requestFinished = () => ({ type: "REQUEST_FINISHED" });
const completeOnboarding = () => ({ type: "ONBOARDING_COMPLETE" });
const userAlreadySignedUp = email => ({
	type: "SIGNUP_EMAIL_EXISTS",
	payload: { email, alreadySignedUp: true }
});

const saveUser = user => dispatch => {
	return db.users.put(user).then(() =>
		dispatch({
			type: "ADD_USER",
			payload: user
		})
	);
};

const saveUsers = users => dispatch => {
	return db
		.transaction("rw", db.users, () => {
			db.users.bulkPut(users).then(() => {
				dispatch({ type: "ADD_USERS", payload: users });
			});
		})
		.catch(e => {
			console.log(e);
		});
};

const addTeams = teams => dispatch => {
	db.teams.bulkPut(teams).then(() =>
		dispatch({
			type: "ADD_TEAMS",
			payload: teams
		})
	);
};

const addTeam = team => dispatch => {
	return db.teams.add(team).then(() => {
		dispatch({
			type: "ADD_TEAM",
			payload: team
		});
	});
};

const addRepos = repos => dispatch => {
	db.repos.bulkPut(repos).then(() =>
		dispatch({
			type: "ADD_REPOS",
			payload: repos
		})
	);
};

const addRepo = repo => dispatch => {
	return db.repos.add(repo).then(() =>
		dispatch({
			type: "ADD_REPO",
			payload: repo
		})
	);
};

const saveTeamAndRepo = ({ team, repo }) => dispatch => {
	return db
		.transaction("rw", db.teams, db.repos, () => {
			db.teams.put(team);
			db.repos.put(repo);
		})
		.then(() => {
			dispatch({
				type: "ADD_REPO",
				payload: repo
			});
			dispatch({
				type: "ADD_TEAM",
				payload: team
			});
		});
};

const saveTeamsAndRepos = ({ teams, repos }) => dispatch => {
	return db
		.transaction("rw", db.teams, db.repos, () => {
			db.teams.bulkPut(teams);
			db.repos.bulkPut(repos);
		})
		.then(() => {
			dispatch({
				type: "ADD_REPOS",
				payload: repos
			});
			dispatch({
				type: "ADD_TEAMS",
				payload: teams
			});
		});
};

const initializeSession = ({ user, accessToken }) => dispatch => {
	db.users.put(user).then(() => {
		dispatch({ type: "UPDATE_USER", payload: user });
		dispatch({ type: "INIT_SESSION", payload: { accessToken, userId: user.id } });
	});
};

const fetchTeamMembers = teams => (dispatch, getState) => {
	const { session } = getState();
	teams.forEach(({ id }) => {
		get(`/users?teamId=${id}`, session.accessToken).then(({ users }) =>
			dispatch(saveUsers(users.map(normalize)))
		);
	});
};

export const goToSignup = () => ({ type: "GO_TO_SIGNUP" });
export const goToLogin = () => ({ type: "GO_TO_LOGIN" });

export const register = attributes => dispatch => {
	post("/no-auth/register", attributes)
		.then(async ({ user }) => {
			user = normalize(user);
			await dispatch(saveUser(user));
			dispatch({ type: "SIGNUP_SUCCESS", payload: { ...attributes, userId: user.id } });
		})
		.catch(({ data }) => {
			if (data.code === "RAPI-1004") dispatch(userAlreadySignedUp(attributes.email));
		});
};

export const confirmEmail = attributes => (dispatch, getState) => {
	dispatch(requestStarted());
	post("/no-auth/confirm", attributes)
		.then(async ({ accessToken, user, teams, repos }) => {
			dispatch(requestFinished());
			user = normalize(user);
			dispatch(initializeSession({ user, accessToken }));

			const { team } = getState();
			const teamForRepo = team && team.id;
			const userTeams = normalize(teams);

			// TODO: handle db error - maybe continue updating the view?
			await dispatch(saveTeamsAndRepos({ teams: userTeams, repos }));

			if (!teamForRepo && userTeams.length === 0)
				dispatch({ type: "NEW_USER_CONFIRMED_IN_NEW_REPO" });
			else if (!teamForRepo && userTeams.length > 0) {
				dispatch(fetchTeamMembers(userTeams));
				dispatch({ type: "EXISTING_USER_CONFIRMED_IN_NEW_REPO" });
			} else if (userTeams.find(team => team.id === teamForRepo)) {
				// TODO: maybe?
				// dispatch(fetchTeamMembers(userTeams));
				dispatch({ type: "EXISTING_USER_CONFIRMED" });
			} else {
				dispatch({ type: "EXISTING_USER_CONFIRMED_IN_FOREIGN_REPO" });
			}
		})
		.catch(({ data }) => {
			dispatch(requestFinished());
			if (data.code === "USRC-1006")
				dispatch({
					type: "USER_ALREADY_CONFIRMED",
					payload: { alreadyConfirmed: true, email: attributes.email }
				});
			if (data.code === "USRC-1004") dispatch({ type: "GO_TO_SIGNUP" });
			if (data.code === "USRC-1002") dispatch({ type: "INVALID_CONFIRMATION_CODE" });
			if (data.code === "usrc-1003") dispatch({ type: "EXPIRED_CONFIRMATION_CODE" });
		});
};

export const sendNewCode = attributes => dispatch => {
	post("/no-auth/register", attributes).catch(({ data }) => {
		if (data.code === "RAPI-1004") atom.notifications.addInfo("Email sent!"); // TODO: return promise so caller can show i18n message
	});
};

export const createTeam = name => (dispatch, getState) => {
	const { session, repoAttributes } = getState();
	const params = {
		url: repoAttributes.url,
		firstCommitHash: repoAttributes.firstCommitHash,
		team: { name }
	};
	dispatch(requestStarted());
	post("/repos", params, session.accessToken).then(async data => {
		dispatch(requestFinished());
		const team = normalize(data.team);
		const repo = normalize(data.repo);

		await dispatch(saveTeamAndRepo({ team, repo }));

		dispatch(setCurrentTeam(team.id));
		dispatch(setCurrentRepo(repo.id));

		dispatch({ type: "TEAM_CREATED", payload: { teamId: team.id } });
	});
};

export const addRepoForTeam = teamId => (dispatch, getState) => {
	const { repoAttributes, session } = getState();
	const params = { ...repoAttributes, teamId };
	dispatch(requestStarted());
	post("/repos", params, session.accessToken)
		.then(async data => {
			const repo = normalize(data.repo);
			dispatch(requestFinished());
			await dispatch(addRepo(repo));
			dispatch(setCurrentRepo(repo.id));
			dispatch({ type: "REPO_ADDED_FOR_TEAM" });
		})
		.catch(error => {
			dispatch(requestFinished());
			if (error.data.code === "RAPI-1003") dispatch(teamNotFound());
			if (error.data.code === "RAPI-1011") dispatch(noPermission());
		});
};

export const teamNotFound = () => ({ type: "TEAM_NOT_FOUND" });
export const noPermission = () => ({ type: "INVALID_PERMISSION_FOR_TEAM" });

export const addMembers = emails => (dispatch, getState) => {
	const { repoAttributes, currentTeamId, session } = getState();
	const params = { ...repoAttributes, teamId: currentTeamId, emails };
	post("/repos", params, session.accessToken)
		.then(({ users }) => {
			dispatch(saveUsers(users.map(normalize)));
			dispatch(completeOnboarding());
		})
		.catch(error => {
			if (error.data.code === "RAPI-1003") dispatch(teamNotFound());
			if (error.data.code === "RAPI-1011") dispatch(noPermission());
		});
};

export const authenticate = params => (dispatch, getState) => {
	dispatch(requestStarted());
	put("/no-auth/login", params)
		.then(async ({ accessToken, user, teams, repos }) => {
			dispatch(requestFinished());
			user = normalize(user);
			await dispatch(saveUser(user));
			dispatch(initializeSession({ accessToken, user }));
			await saveTeamsAndRepos({
				teams: normalize(teams),
				repos: normalize(repos)
			});
			dispatch({ type: "LOGGED_IN" });
		})
		.catch(error => {
			dispatch(requestFinished());
			dispatch({ type: "INVALID_CREDENTIALS" });
		});
};

export default {
	goToSignup,
	register,
	confirmEmail,
	sendNewCode,
	authenticate,
	createTeam
};
