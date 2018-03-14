import { upsert } from "../local-cache";
import { normalize } from "./utils";

export const fetchCompanies = ids => (dispatch, getState, { db, http }) => {
	return http.get(`/companies?ids=${ids.join(",")}`, getState().session.accessToken).then(data => {
		return dispatch(saveCompanies(normalize(data.companies)));
	});
};

export const saveCompany = attributes => (dispatch, getState, { db }) => {
	return upsert(db, "companies", attributes).then(company =>
		dispatch({ type: "ADD_COMPANY", payload: company })
	);
};

export const saveCompanies = attributes => (dispatch, getState, { db }) => {
	return upsert(db, "companies", attributes).then(companies =>
		dispatch({ type: "ADD_COMPANIES", payload: companies })
	);
};
