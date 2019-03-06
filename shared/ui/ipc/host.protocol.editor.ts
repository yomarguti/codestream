import { CSMarker } from "@codestream/protocols/api";
import { RequestType } from "vscode-jsonrpc";
import { Range } from "vscode-languageserver-types";
import { IpcRoutes } from "./webview.protocol.common";

export interface EditorHighlightRangeRequest {
	uri: string;
	// NOTE: A single-line range with start & end char of 0 indicates a full-line highlight
	range: Range;
	highlight: boolean;
}
export interface EditorHighlightRangeResponse {}
export const EditorHighlightRangeRequestType = new RequestType<
	EditorHighlightRangeRequest,
	EditorHighlightRangeResponse,
	void,
	void
>(`${IpcRoutes.Host}/editor/highlight/range`);

// DEPRECATED: use EditorHighlightRangeRequestType
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

// DEPRECATED: use EditorHighlightRangeRequestType
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

export enum EditorRevealRangeResult {
	Success = "SUCCESS",
	FileNotFound = "FILE_NOT_FOUND",
	// TODO: Remove?
	RepoNotInWorkspace = "REPO_NOT_IN_WORKSPACE"
}

export interface EditorRevealRangeRequest {
	uri: string;
	range: Range;
	preserveFocus?: boolean;
}
export interface EditorRevealRangeResponse {
	result: EditorRevealRangeResult;
}
export const EditorRevealRangeRequestType = new RequestType<
	EditorRevealRangeRequest,
	EditorRevealRangeResponse,
	void,
	void
>(`${IpcRoutes.Host}/editor/reveal/range`);

// DEPRECATED: use EditorRevealRangeRequestType
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

// DEPRECATED: use EditorRevealRangeRequestType
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
