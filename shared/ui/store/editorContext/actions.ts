import { action } from "../common";
import { EditorContextState, EditorContextActionsType } from "./types";

export const reset = () => action("RESET");

export const setEditorContext = (payload: Partial<EditorContextState>) =>
	action(EditorContextActionsType.SetEditorContext, payload);
