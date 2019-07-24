import { Dispatch, Middleware } from "redux";
import { CodeStreamState } from ".";

class DataTransformer {
	private transformers = new Map<string, Set<Function>>();

	createMiddleware() {
		const middleware: Middleware<any, CodeStreamState, Dispatch> = _store => {
			return next => action => {
				let transformedAction = action;

				const transformers = this.transformers.get(action.type);

				if (transformers != undefined && transformers.size > 0) {
					transformedAction.payload = [...transformers.keys()].reduce(
						(payload, transform) => transform(payload),
						action.payload
					);
				}

				return next(transformedAction);
			};
		};

		return middleware;
	}

	addTransformer(type: string, predicate: (object: any) => any): () => void {
		const transformersForType = this.transformers.has(type)
			? this.transformers.get(type)
			: this.transformers.set(type, new Set()).get(type);

		transformersForType!.add(predicate);

		return () => {
			transformersForType!.delete(predicate);
		};
	}
}

export const dataTransformer = new DataTransformer();
