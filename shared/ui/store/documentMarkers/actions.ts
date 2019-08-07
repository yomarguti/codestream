import { DocumentMarkersActionsType } from "./types";
import { DocumentMarker, FetchDocumentMarkersRequestType } from "@codestream/protocols/agent";
import { action } from "../common";
import { HostApi } from "@codestream/webview/webview-api";

export const reset = () => action("RESET");

export const saveDocumentMarkers = (uri: string, markers: DocumentMarker[]) =>
	action(DocumentMarkersActionsType.SaveForFile, { uri, markers });

export const addDocumentMarker = (uri: string, marker: DocumentMarker) =>
	action(DocumentMarkersActionsType.SaveOneForFile, { uri, marker });

export const fetchDocumentMarkers = (uri: string) => async dispatch => {
	const response = await HostApi.instance.send(FetchDocumentMarkersRequestType, {
		textDocument: { uri }
	});

	if (response && response.markers) {
		return dispatch(saveDocumentMarkers(uri, response.markers));
	}
};
