import { action } from "../common";
import { State, EditorContextActionsType } from "./types";

export const reset = () => action("RESET");

export const setEditorContext = (payload: Partial<State>) =>
	action(EditorContextActionsType.SetEditorContext, payload);
