const initialState = {
	complete: false,
	requestInProcess: false,
	step: "signUp",
	props: {},
	errors: {}
};

export default (state = initialState, { type, payload }) => {
	switch (type) {
		case "LOAD_ONBOARDING":
			return payload || state;
		case "REQUEST_STARTED":
			return { ...state, requestInProcess: true };
		case "REQUEST_FINISHED":
			return { ...state, requestInProcess: false };
		case "SIGNUP_SUCCESS":
			return { ...state, step: "confirmEmail", props: payload };
		case "SIGNUP_EMAIL_EXISTS":
			return { ...state, step: "login", props: payload };
		case "GO_TO_LOGIN":
			return { ...initialState, step: "login" };
		case "GO_TO_SIGNUP":
			return { ...initialState, step: "signUp" };
		case "NEW_USER_CONFIRMED_IN_NEW_REPO":
			return { ...initialState, step: "createTeam" };
		case "EXISTING_USER_CONFIRMED_IN_NEW_REPO":
			return { ...initialState, step: "selectTeam" };
		case "EXISTING_USER_CONFIRMED":
			return { ...initialState, complete: true };
		case "INVALID_CONFIRMATION_CODE":
			return { ...state, errors: { invalidCode: true } };
		case "EXPIRED_CONFIRMATION_CODE":
			return { ...state, errors: { expiredCode: true } };
		case "TEAM_CREATED":
			return { ...state, step: "identifyMembers", props: payload };
		case "TEAM_NOT_FOUND":
			return { ...state, errors: { teamNotFound: true } };
		case "INVALID_PERMISSION_FOR_TEAM":
			return { ...state, errors: { noPermission: true } };
		case "REPO_ADDED_FOR_TEAM":
			return { ...initialState, step: "identifyMembers", props: { existingTeam: true } };
		case "INVALID_CREDENTIALS":
			return { ...initialState, errors: { invalidCredentials: true } };
		case "LOGGED_IN":
		case "ONBOARDING_COMPLETE":
			return { ...initialState, complete: true };
		case "RESET_ONBOARDING":
			return initialState;
		default:
			return state;
	}
};
