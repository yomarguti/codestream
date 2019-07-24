import { contextChangeObserver } from "./context-changes";
import { sideEffects } from "./side-effects";
import { logging } from "./logging";
import { dataTransformer } from "../data-filter";

export default [contextChangeObserver, dataTransformer.createMiddleware(), sideEffects, logging];
