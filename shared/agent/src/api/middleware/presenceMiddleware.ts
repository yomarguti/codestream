// import { CodeStreamApiMiddleware, CodeStreamApiMiddlewareContext } from "../api";
// import { PresenceManager } from "../../presence";

// export class PresenceMiddleware implements CodeStreamApiMiddleware {
// 	constructor(private _manager: PresenceManager) {}

// 	get name() {
// 		return "Presence";
// 	}

// 	async onRequest(context: CodeStreamApiMiddlewareContext) {
// 		if (context.url.endsWith("/presence")) return;

// 		this._manager.online();
// 	}
// }
