import { contextChangeObserver } from "./context-changes";
import { sideEffects } from "./side-effects";
import { logging } from "./logging";

export default [contextChangeObserver, sideEffects, logging];
