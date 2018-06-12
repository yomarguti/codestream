import { ApiMiddleware, ApiMiddlewareContext } from "./api";
import { PresenceManager } from "./presence";

export class PresenceMiddleware implements ApiMiddleware {
	constructor(private _manager: PresenceManager) {}

	get name() {
		return "Presence";
	}

	async onRequest(context: ApiMiddlewareContext) {
		if (context.url.endsWith("/presence")) return;

		this._manager.online();
	}
}
