import { Type } from "../actions/codemarks";
import { toMapBy } from "../utils";

interface State {
	[codemarkId: string]: object;
}
interface Action {
	type: string;
	payload: any;
}

const initialState: State = {};

export default function(state = initialState, { type, payload }: Action) {
	switch (type) {
		case Type.SAVE_CODEMARKS: {
			return { ...state, ...toMapBy("id", payload) };
		}
	}
	return state;
}

export function getCodemark(state: State, id?: string): object | undefined {
	if (!id) return undefined;
	return state[id];
}
