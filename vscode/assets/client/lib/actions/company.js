import { upsert } from "../local-cache";

export const fetchCompanies = ids => (dispatch, getState, { api }) => {
	return api.fetchCompanies(ids).then(data => {
		return dispatch(saveCompanies(data.companies));
	});
};

export const saveCompany = attributes => (dispatch, getState, { db }) => {
	return upsert(db, "companies", attributes).then(company =>
		dispatch({ type: "ADD_COMPANY", payload: company })
	);
};

export const saveCompanies = companies => (dispatch, getState) => {
	// return upsert(db, "companies", attributes).then(companies =>
	return dispatch({ type: "ADD_COMPANIES", payload: companies });
	// );
};
