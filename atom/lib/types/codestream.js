// @flow
import type { Store as ReduxStore } from "redux";

export interface Resource {
	destroy(): void;
}

type State = {};
type Action = { type: string };
export type Store = ReduxStore<State, Action>;
