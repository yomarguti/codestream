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
