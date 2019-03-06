import { DocumentMarker } from "@codestream/protocols/agent";
import { Index } from "../common";

export interface State extends Index<DocumentMarker[]> {}

export enum DocumentMarkersActionsType {
	SaveForFile = "@documentMarkers/save"
}
