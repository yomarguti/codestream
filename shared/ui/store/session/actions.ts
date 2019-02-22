import { action } from "../common";
import { SessionActionType, State } from "./types";

export const reset = () => action("RESET");

export const setSession = (session: Partial<State>) => action(SessionActionType.Set, session);
