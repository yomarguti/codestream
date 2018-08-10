import { toMapBy } from "./utils";
import _ from "underscore";

const initialState = { lastReads: {}, mentions: {}, unread: {} };

function getSum(total, num) {
	return total + Math.round(num);
}

function calcTotals(state) {
	state.totalUnread = Object.values(state.unread).reduce(getSum, 0);
	state.totalMentions = Object.values(state.mentions).reduce(getSum, 0);
	return state;
}

export default (state = initialState, { type, payload }) => {
	switch (type) {
		case "UPDATE_UNREADS": {
			return payload;
		}
		// ---- LEGACY: these will be removed once atom is no longer using them
		case "INCREMENT_UMI": {
			// console.log("incrementint umis in the reducer: ", payload);
			let nextState = { ...state };
			nextState.unread[payload] = (nextState.unread[payload] || 0) + 1;
			// console.log("STATE IS: ", nextState);
			return calcTotals(nextState);
		}
		case "INCREMENT_MENTION": {
			// console.log("incrementing mention in the reducer: ", payload);
			// payload is a streamId
			let nextState = { ...state };
			nextState.mentions[payload] = (nextState.mentions[payload] || 0) + 1;
			nextState.unread[payload] = (nextState.unread[payload] || 0) + 1;
			return calcTotals(nextState);
		}
		case "CLEAR_UMI": {
			console.log("clear umis in the reducer: ", payload);
			let nextState = { ...state };
			// instead of deleting it, we set it to zero
			// so that when we loop through the keys we can
			// still reference the fact that this div needs to be cleared
			if (nextState.mentions[payload]) nextState.mentions[payload] = 0;
			if (nextState.unread[payload]) nextState.unread[payload] = 0;
			return calcTotals(nextState);
		}
		case "SET_UMI": {
			return calcTotals(payload);
		}
		// ---- END LEGACY
		case "RESET_UMI": {
			let nextState = { ...initialState };
			return calcTotals(nextState);
		}
		default:
			return state;
	}
	return state;
};
