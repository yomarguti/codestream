import { FetchThirdPartyBoardsRequest } from "@codestream/protocols/agent";
import { CSMarker } from "@codestream/protocols/api";
import { RequestType } from "vscode-jsonrpc";

export interface GoToSlackSigninResponse {}

export const GoToSlackSigninRequestType = new RequestType<
	void,
	GoToSlackSigninResponse,
	void,
	void
>("extension/go-to-slack-signin");

export interface GetViewBootstrapDataResponse {
	unreads: any;
	// TODO: fill out the rest
}

export interface ValidateSignupRequest {
	token?: string;
}

export const ValidateSignupRequestType = new RequestType<
	ValidateSignupRequest,
	GetViewBootstrapDataResponse,
	void,
	void
>("extension/validate-signup");

export interface LoginRequest {
	email: string;
	password: string;
}
export const LoginRequestType = new RequestType<
	LoginRequest,
	GetViewBootstrapDataResponse,
	void,
	void
>("extension/authenticate");

export const GetViewBootstrapDataRequestType = new RequestType<
	void,
	GetViewBootstrapDataResponse,
	void,
	void
>("extension/bootstrap");

export interface ShowMarkersInEditorRequest {
	enable: boolean;
}

export interface ShowMarkersInEditorResponse {}

export const ShowMarkersInEditorRequestType = new RequestType<
	ShowMarkersInEditorRequest,
	ShowMarkersInEditorResponse,
	void,
	void
>("extension/show-markers");

export interface MuteAllConversationsRequest {
	mute: boolean;
}

export interface MuteAllConversationsResponse {}

export const MuteAllConversationsRequestType = new RequestType<
	MuteAllConversationsRequest,
	MuteAllConversationsResponse,
	void,
	void
>("extension/mute-all");

export interface OpenCommentOnSelectRequest {
	enable: boolean;
}

export interface OpenCommentOnSelectResponse {}

export const OpenCommentOnSelectInEditorRequestType = new RequestType<
	OpenCommentOnSelectRequest,
	OpenCommentOnSelectResponse,
	void,
	void
>("extension/open-comment-on-select");

export const getFetchIssueBoardsCommand = (service: string) =>
	new RequestType<FetchThirdPartyBoardsRequest, { boards: any[] }, void, void>(
		`codeStream/${service}/boards`
	);

export interface StartSignupRequest {}
export interface StartSignupResponse {}

export const StartSignupRequestType = new RequestType<
	StartSignupRequest,
	StartSignupResponse,
	void,
	void
>("extension/go-to-signup");

export interface SignOutRequest {}
export interface SignOutResponse {}

export const SignOutRequestType = new RequestType<SignOutRequest, SignOutResponse, void, void>(
	"extension/sign-out"
);

export interface ShowCodeRequest {
	marker: CSMarker;
	enteringThread: boolean;
}

export interface ShowCodeResponse {
	status: string;
}

export const ShowCodeRequestType = new RequestType<ShowCodeRequest, ShowCodeResponse, void, void>(
	"extension/show-code"
);

export interface HighlightCodeRequest {
	uri: string;
	marker: CSMarker;
	highlight: boolean;
	source: string;
}

export interface HighlightCodeResponse {
	result: any;
}

export const HighlightCodeRequestType = new RequestType<
	HighlightCodeRequest,
	HighlightCodeResponse,
	void,
	void
>("extension/highlight-code");

export interface HighlightLineRequest {
	uri: string;
	line: number;
	highlight: boolean;
	source: string;
}

export interface HighlightLineResponse {
	result: any;
}

export const HighlightLineRequestType = new RequestType<
	HighlightLineRequest,
	HighlightLineResponse,
	void,
	void
>("extension/highlight-line");

export interface RevealFileLineRequest {
	line: number;
}

export interface RevealFileLineResponse {}

export const RevealFileLineRequestType = new RequestType<
	RevealFileLineRequest,
	RevealFileLineResponse,
	void,
	void
>("extension/reveal-line");

export interface StartCommentOnLineRequest {
	line: number;
	uri: any;
	type: any;
}

export interface StartCommentOnLineResponse {}

export const StartCommentOnLineRequestType = new RequestType<
	StartCommentOnLineRequest,
	StartCommentOnLineResponse,
	void,
	void
>("extension/start-comment-on-line");

export const ReloadWebviewRequestType = new RequestType<void, void, void, void>(
	"extension/reload-webview"
);

export interface InviteToLiveShareRequest {
	userId: string;
	createNewStream: boolean;
}

export interface InviteToLiveShareResponse {}

export const InviteToLiveShareRequestType = new RequestType<
	InviteToLiveShareRequest,
	InviteToLiveShareResponse,
	void,
	void
>("extension/invite-to-liveshare");

export interface StartLiveShareRequest {
	streamId: string;
	threadId: string;
	createNewStream: boolean;
}

export interface StartLiveShareResponse {}

export const StartLiveShareRequestType = new RequestType<
	StartLiveShareRequest,
	StartLiveShareResponse,
	void,
	void
>("extension/start-liveshare");

export interface JoinLiveShareRequest {
	url: string;
}

export interface JoinLiveShareResponse {}

export const JoinLiveShareRequestType = new RequestType<
	JoinLiveShareRequest,
	JoinLiveShareResponse,
	void,
	void
>("extension/join-liveshare");

export interface ShowDiffRequest {
	marker: CSMarker;
}
export interface ShowDiffResponse {}

export const ShowDiffRequestType = new RequestType<ShowDiffRequest, ShowDiffResponse, void, void>(
	"extension/show-diff"
);

export interface ApplyPatchRequest {
	marker: CSMarker;
}

export interface ApplyPatchResponse {}

export const ApplyPatchRequestType = new RequestType<
	ApplyPatchRequest,
	ApplyPatchResponse,
	void,
	void
>("extension/apply-patch");

export interface UpdateConfigurationRequest {
	name: string;
	value: any;
}

export interface UpdateConfigurationResponse {}

export const UpdateConfigurationRequestType = new RequestType<
	UpdateConfigurationRequest,
	UpdateConfigurationResponse,
	void,
	void
>("extension/configuration/update");
