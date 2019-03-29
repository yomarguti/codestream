import { RequestType } from "vscode-jsonrpc";
import { Range } from "vscode-languageserver-types";
import { IpcRoutes } from "./webview.protocol.common";

export interface EditorGetRangeSha1Request {
	uri: string;
	range: Range;
}
export interface EditorGetRangeSha1Response {
	sha1: string | undefined;
}
export const EditorGetRangeSha1RequestType = new RequestType<
	EditorGetRangeSha1Request,
	EditorGetRangeSha1Response,
	void,
	void
>(`${IpcRoutes.Host}/editor/range/sha1`);

export interface EditorHighlightRangeRequest {
	uri: string;
	range: Range;
	highlight: boolean;
}
export interface EditorHighlightRangeResponse {}
export const EditorHighlightRangeRequestType = new RequestType<
	EditorHighlightRangeRequest,
	EditorHighlightRangeResponse,
	void,
	void
>(`${IpcRoutes.Host}/editor/range/highlight`);

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
	atTop?: boolean;
}
export interface EditorRevealRangeResponse {
	result: EditorRevealRangeResult;
}
export const EditorRevealRangeRequestType = new RequestType<
	EditorRevealRangeRequest,
	EditorRevealRangeResponse,
	void,
	void
>(`${IpcRoutes.Host}/editor/range/reveal`);

export interface EditorSelectRangeRequest {
	uri: string;
	range: Range;
	preserveFocus?: boolean;
}
export interface EditorSelectRangeResponse {}
export const EditorSelectRangeRequestType = new RequestType<
	EditorSelectRangeRequest,
	EditorSelectRangeResponse,
	void,
	void
>(`${IpcRoutes.Host}/editor/range/select`);
