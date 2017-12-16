import db from "../local-cache";

export const saveTeam = team => dispatch => {
	return db.teams.put(team).then(() => dispatch({ type: "ADD_TEAM", payload: team }));
};

export const saveTeams = teams => dispatch => {
	return db.teams.bulkPut(teams).then(() => dispatch({ type: "ADD_TEAMS", payload: teams }));
};
