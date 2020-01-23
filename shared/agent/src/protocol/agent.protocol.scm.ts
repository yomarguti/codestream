"use strict";
import { Range, RequestType } from "vscode-languageserver-protocol";
// import { GitCommit } from "./agent.protocol";

export interface GetCommitScmInfoRequest {
	revision: string;
	repoPath?: string;
	repoId?: string;
}
export interface GetCommitScmInfoResponse {
	scm?: {
		repoPath: string;
		revision: string;
		message: string;
		shortMessage: string;
		author: string;
		authorDate: Date;
		// committer: string;
		// committerDate: string;
	};
	error?: string;
}
export const GetCommitScmInfoRequestType = new RequestType<
	GetCommitScmInfoRequest,
	GetCommitScmInfoResponse,
	void,
	void
>("codestream/scm/commit");

export enum LocalChangesToIncludeType {
	All = 0,
	Saved = 1,
	Staged = 2,
	None = 3
}

export interface GetRepoScmStatusRequest {
	uri: string;
	localChangesToInclude?: LocalChangesToIncludeType;
	startCommit?: string;
	includeSaved: boolean;
	includeStaged: boolean;
}
export interface GetRepoScmStatusResponse {
	uri: string;
	scm?: {
		repoPath: string;
		repoId?: string;
		branch?: string;
		commits?: { sha: string; info: {} }[];
		addedFiles: string[];
		deletedFiles: string[];
		modifiedFiles: {
			file: string;
			linesAdded: number;
			linesRemoved: number;
		}[];
		savedFiles: string[];
		stagedFiles: string[];
		authors: { id: string; username: string }[];
		// this is just the total number of lines modified so that
		// we can throw up a warning if it's too many ("shift left")
		totalModifiedLines: number;
	};
	error?: string;
}
export const GetRepoScmStatusRequestType = new RequestType<
	GetRepoScmStatusRequest,
	GetRepoScmStatusResponse,
	void,
	void
>("codestream/scm/repo/status");

export interface GetFileScmInfoRequest {
	uri: string;
}
export interface GetFileScmInfoResponse {
	uri: string;
	scm?: {
		file: string;
		repoPath: string;
		revision: string;
		remotes: { name: string; url: string }[];
		branch?: string;
	};
	error?: string;
}
export const GetFileScmInfoRequestType = new RequestType<
	GetFileScmInfoRequest,
	GetFileScmInfoResponse,
	void,
	void
>("codestream/scm/file/info");

export interface GetRangeScmInfoRequest {
	uri: string;
	range: Range;
	dirty?: boolean;
	contents?: string;
	skipBlame?: boolean;
}
export interface GetRangeScmInfoResponse {
	uri: string;
	range: Range;
	contents: string;
	scm?: {
		file: string;
		repoPath: string;
		repoId?: string;
		revision: string;
		authors: { id: string; username: string }[];
		remotes: { name: string; url: string }[];
		branch?: string;
	};
	error?: string;
}
export const GetRangeScmInfoRequestType = new RequestType<
	GetRangeScmInfoRequest,
	GetRangeScmInfoResponse,
	void,
	void
>("codestream/scm/range/info");

export interface GetRangeSha1Request {
	uri: string;
	range: Range;
}
export interface GetRangeSha1Response {
	sha1: string | undefined;
}
export const GetRangeSha1RequestType = new RequestType<
	GetRangeSha1Request,
	GetRangeSha1Response,
	void,
	void
>("codestream/scm/range/sha1");
