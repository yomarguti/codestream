"use strict";
import { Range, RequestType } from "vscode-languageserver-protocol";

export interface GetRangeScmInfoRequest {
	uri: string;
	range: Range;
	dirty: boolean;
	contents?: string;
}

export interface GetRangeScmInfoResponse {
	uri: string;
	range: Range;
	scm?: {
		file: string;
		repoPath: string;
		revision: string;
		authors: { id: string; username: string }[];
		remotes: { name: string; url: string }[];
	};
	error?: string;
}

export const GetRangeScmInfoRequestType = new RequestType<
	GetRangeScmInfoRequest,
	GetRangeScmInfoResponse,
	void,
	void
>("codestream/scm/range/info");
