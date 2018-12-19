import { AnyAction } from "redux";

export type StringType = string;

export type PayloadMetaAction<T extends StringType, P, M> = P extends void
	? M extends void
		? { type: T }
		: { type: T; meta: M }
	: M extends void
	? { type: T; payload: P }
	: { type: T; payload: P; meta: M };

type ActionCreator<T extends StringType = StringType> = (...args: any[]) => { type: T };

type ActionCreatorMap<T> = { [K in keyof T]: ActionType<T[K]> };

export type ActionType<ActionCreatorOrMap> = ActionCreatorOrMap extends ActionCreator
	? ReturnType<ActionCreatorOrMap>
	: ActionCreatorOrMap extends object
	? ActionCreatorMap<ActionCreatorOrMap>[keyof ActionCreatorOrMap]
	: never;

export function action<T extends StringType, P = undefined, M = undefined>(
	type: T,
	payload?: P
): PayloadMetaAction<T, P, M> {
	return { type, payload } as any;
}

export interface Action<T> extends AnyAction {
	type: T;
}

export interface Index<T> {
	[key: string]: T;
}
