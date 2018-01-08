import { upsert } from "../local-cache";
import http from "../network-request";
import { saveUsers } from "./user";
import { saveRepo } from "./repo";
import { normalize } from "./utils";

export const saveTeam = attributes => (dispatch, getState, { db }) => {
	return upsert(db, "teams", attributes).then(team =>
		dispatch({ type: "ADD_TEAM", payload: team })
	);
};

export const saveTeams = attributes => (dispatch, getState, { db }) => {
	return upsert(db, "teams", attributes).then(teams =>
		dispatch({ type: "ADD_TEAMS", payload: teams })
	);
};

export const fetchTeamMembers = teamId => (dispatch, getState, { http }) => {
	if (Array.isArray(teamId)) return Promise.all(teamId.map(id => dispatch(fetchTeamMembers(id))));
	const { session } = getState();
	return http
		.get(`/users?teamId=${teamId}`, session.accessToken)
		.then(({ users }) => dispatch(saveUsers(normalize(users))));
};

export const joinTeam = () => (dispatch, getState) => {
	const { repoAttributes, session } = getState();
	return http.post("/repos", repoAttributes, session.accessToken).then(async data => {
		await dispatch(saveUsers(normalize(data.users)));
		await dispatch(fetchTeamMembers(data.repo.teamId));
		return await dispatch(saveRepo(normalize(data.repo)));
	});
};
