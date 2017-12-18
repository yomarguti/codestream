import db, { upsert } from "../local-cache";

export const saveTeam = attributes => dispatch => {
	return upsert(db, "teams", attributes).then(team =>
		dispatch({ type: "ADD_TEAM", payload: team })
	);
};

export const saveTeams = attributes => dispatch => {
	return upsert(db, "teams", attributes).then(teams =>
		dispatch({ type: "ADD_TEAMS", payload: teams })
	);
};
