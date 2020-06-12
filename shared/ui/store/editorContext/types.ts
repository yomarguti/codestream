import { EditorContext } from "@codestream/protocols/webview";

export type EditorContextState = EditorContext;

export enum EditorContextActionsType {
	SetEditorContext = "@editorContext/Set",
	SetCurrentFile = "@editorContext/SetCurrentFile"
}
