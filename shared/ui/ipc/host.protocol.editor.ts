import { CSMarker } from "@codestream/protocols/api";
import { RequestType } from "vscode-jsonrpc";
import { IpcRoutes } from "./webview.protocol.common";

export interface EditorHighlightLineRequest {
	uri: string;
	line: number;
	highlight: boolean;
	source: string;
}

export interface EditorHighlightLineResponse {
	result: string | undefined;
}

export const EditorHighlightLineRequestType = new RequestType<
	EditorHighlightLineRequest,
	EditorHighlightLineResponse,
	void,
	void
>(`${IpcRoutes.Host}/editor/highlight/line`);

export interface EditorHighlightMarkerRequest {
	uri: string;
	marker: CSMarker;
	highlight: boolean;
	source: string;
}

export interface EditorHighlightMarkerResponse {
	result: string | undefined;
}

export const EditorHighlightMarkerRequestType = new RequestType<
	EditorHighlightMarkerRequest,
	EditorHighlightMarkerResponse,
	void,
	void
>(`${IpcRoutes.Host}/editor/highlight/marker`);

export interface EditorRevealLineRequest {
	line: number;
}

export interface EditorRevealLineResponse {}

export const EditorRevealLineRequestType = new RequestType<
	EditorRevealLineRequest,
	EditorRevealLineResponse,
	void,
	void
>(`${IpcRoutes.Host}/editor/reveal/line`);

export interface EditorRevealMarkerRequest {
	marker: CSMarker;
	preserveFocus: boolean;
}

export interface EditorRevealMarkerResponse {
	result: string | undefined;
}

export const EditorRevealMarkerRequestType = new RequestType<
	EditorRevealMarkerRequest,
	EditorRevealMarkerResponse,
	void,
	void
>(`${IpcRoutes.Host}/editor/reveal/marker`);
