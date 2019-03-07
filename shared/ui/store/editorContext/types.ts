import { EditorContext } from "@codestream/protocols/webview";

export type State = EditorContext;

export enum EditorContextActionsType {
	SetEditorContext = "@editorContext/Set",
	SetCurrentFile = "@editorContext/SetCurrentFile"
}
