import { DocumentActionsType } from "./types";
import {
	Document	
} from "@codestream/protocols/agent";
import { action } from "../common";

export const reset = () => action("RESET");

export const updateDocument = (
	document: Document,
) => action(DocumentActionsType.Update, document);

export const removeDocument = (
	document: Document,
) => action(DocumentActionsType.Remove, document);
