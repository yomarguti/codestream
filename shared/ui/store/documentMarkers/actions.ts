import { DocumentMarkersActionsType } from "./types";
import { DocumentMarker, DocumentMarkersRequestType } from "@codestream/protocols/agent";
import { action } from "../common";
import { HostApi } from "@codestream/webview/webview-api";

export const reset = () => action("RESET");

export const saveDocumentMarkers = (uri: string, markers: DocumentMarker[]) =>
	action(DocumentMarkersActionsType.SaveForFile, { uri, markers });

export const fetchDocumentMarkers = (uri: string) => async dispatch => {
	const response = await HostApi.instance.send(DocumentMarkersRequestType, {
		textDocument: { uri }
	});

	if (response && response.markers) {
		return dispatch(saveDocumentMarkers(uri, response.markers));
	}
};
