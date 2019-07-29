import { contextChangeObserver } from "./context-changes";
import { sideEffects } from "./side-effects";
import { logging } from "./logging";
import { middlewareInjector } from "../middleware-injector";

export default [contextChangeObserver, middlewareInjector.createMiddleware(), sideEffects, logging];
