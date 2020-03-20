import { RequestType } from "vscode-jsonrpc";
import { IpcRoutes } from "./webview.protocol";

export interface ReviewShowDiffRequest {
	reviewId: string;
	repoId: string;
	path: string;
}

export interface ReviewShowDiffResponse {}

export const ReviewShowDiffRequestType = new RequestType<
	ReviewShowDiffRequest,
	ReviewShowDiffResponse,
	void,
	void
>(`${IpcRoutes.Host}/review/showDiff`);

export interface ReviewShowLocalDiffRequest {
	repoId: string;
	path: string;
	includeSaved: boolean;
	includeStaged: boolean;
	baseSha: string;
}

export interface ReviewShowLocalDiffResponse {}

export const ReviewShowLocalDiffRequestType = new RequestType<
	ReviewShowLocalDiffRequest,
	ReviewShowLocalDiffResponse,
	void,
	void
>(`${IpcRoutes.Host}/review/showLocalDiff`);

export interface ReviewCloseDiffRequest {}

export interface ReviewCloseDiffResponse {}

export const ReviewCloseDiffRequestType = new RequestType<
	ReviewCloseDiffRequest,
	ReviewCloseDiffResponse,
	void,
	void
>(`${IpcRoutes.Host}/review/closeDiff`);

export interface TraverseDiffsRequest {
	direction: "next" | "previous";
}

export interface TraverseDiffsResponse {}

export const TraverseDiffsRequestType = new RequestType<
	TraverseDiffsRequest,
	TraverseDiffsResponse,
	void,
	void
>(`${IpcRoutes.Host}/review/diffs/traverse`);
