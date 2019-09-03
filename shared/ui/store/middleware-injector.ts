import { Dispatch, Middleware } from "redux";
import { CodeStreamState } from ".";

class MiddlewareInjector {
	private middleware = new Map<string, Set<Function>>();

	createMiddleware() {
		const middleware: Middleware<any, CodeStreamState, Dispatch> = _store => {
			return next => action => {
				let result = action;

				try {
					const injectedMiddleware = this.middleware.get(action.type);

					if (injectedMiddleware != undefined && injectedMiddleware.size > 0) {
						result.payload = [...injectedMiddleware.keys()].reduce(
							(payload, transform) => transform(payload),
							action.payload
						);
					}
				} catch (error) {}

				return next(result);
			};
		};

		return middleware;
	}

	inject(type: string, fn: (object: any) => any): () => void {
		const middlewareForType = this.middleware.has(type)
			? this.middleware.get(type)
			: this.middleware.set(type, new Set()).get(type);

		middlewareForType!.add(fn);

		return () => {
			middlewareForType!.delete(fn);
		};
	}
}

export const middlewareInjector = new MiddlewareInjector();
