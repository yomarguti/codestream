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

export const joinTeam = () => (dispatch, getState) => {
	const { repoAttributes, session } = getState();
	return http.post("/repos", repoAttributes, session.accessToken).then(async data => {
		await dispatch(saveUsers(normalize(data.users)));
		return await dispatch(saveRepo(normalize(data.repo)));
	});
};
