export type StringType = string;

export type PayloadMetaAction<T extends StringType, P, M> = P extends void
	? M extends void
		? { type: T }
		: { type: T; meta: M }
	: M extends void
	? { type: T; payload: P }
	: { type: T; payload: P; meta: M };

export type ActionCreator<T extends StringType = StringType> = (...args: any[]) => Action<T>;

export type ThunkedActionCreator<T extends StringType = StringType> = (
	...args: any[]
) => AsyncActionCreator<T>;

export interface AsyncActionCreator<T> {
	(dispatch: Dispatch, ...args: any[]): Promise<Action<T> | void>;
}

type ActionCreatorMap<T> = { [K in keyof T]: ActionType<T[K]> };

export type ActionType<ActionCreatorOrMap> = ActionCreatorOrMap extends ActionCreator
	? ReturnType<ActionCreatorOrMap>
	: ActionCreatorOrMap extends object
	? ActionCreatorMap<ActionCreatorOrMap>[keyof ActionCreatorOrMap]
	: never;

export function action<T extends StringType, P = undefined, M = undefined>(
	type: T,
	payload?: P,
	meta?: M
): PayloadMetaAction<T, P, M> {
	return { type, payload, meta } as any;
}

export interface Action<T> {
	type: T;
	[key: string]: any;
}

export interface Index<T> {
	[key: string]: T;
}

type DispatchReturn<ActionOrAsyncCreator extends any> = ActionOrAsyncCreator extends Action<any>
	? ActionOrAsyncCreator
	: ActionOrAsyncCreator extends AsyncActionCreator<any>
	? ReturnType<ActionOrAsyncCreator>
	: never;

export interface Dispatch {
	<A extends Action<any> | AsyncActionCreator<any>>(actionOrAsyncCreator: A): DispatchReturn<A>;
}

export interface DispatchProp {
	dispatch: Dispatch;
}
