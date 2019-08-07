import { DocumentMarker } from "@codestream/protocols/agent";
import { Index } from "../common";

export interface DocumentMarkersState extends Index<DocumentMarker[]> {}

export enum DocumentMarkersActionsType {
	SaveForFile = "@documentMarkers/SaveForFile",
	SaveOneForFile = "@documentMarkers/SaveOne"
}
