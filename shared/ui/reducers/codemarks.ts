import { Type } from "../actions/codemarks";
import { toMapBy } from "../utils";

interface State {
	[codemarkId: string]: Codemark;
}
interface Action {
	type: string;
	payload: any;
}

interface Codemark {
	type: string;
}

const initialState: State = {};

export default function(state = initialState, { type, payload }: Action) {
	switch (type) {
		case Type.UPDATE_CODEMARKS:
		case Type.SAVE_CODEMARKS: {
			return { ...state, ...toMapBy("id", payload) };
		}
		default:
			return state;
	}
}

export function getCodemark(state: State, id?: string): Codemark | undefined {
	if (!id) return undefined;
	return state[id];
}

export function getByType(state: State, type?: string): Codemark[] {
	if (!type) return Object.values(state);

	return Object.values(state).filter(codemark => codemark.type === type);
}
