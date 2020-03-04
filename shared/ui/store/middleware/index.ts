import { contextChangeObserver } from "./context-changes";
import { sideEffects } from "./side-effects";
import { logging } from "./logging";
import { middlewareInjector } from "../middleware-injector";
import { activityFeedMiddleware } from "../activityFeed/middleware";
import { sessionMiddleware } from "../session/middleware";

export default [
	contextChangeObserver,
	middlewareInjector.createMiddleware(),
	sideEffects,
	logging,
	activityFeedMiddleware,
	sessionMiddleware
];
