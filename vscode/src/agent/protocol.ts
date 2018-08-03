import { CSPost } from "codestream";
import {
	ApiRequestParams,
	DidReceivePubNubMessagesNotificationParams,
	DocumentMarkersRequestParams,
	DocumentMarkersResponse,
	DocumentPostRequestParams,
	DocumentPreparePostRequestParams,
	DocumentPreparePostResponse,
	GitRepositoriesResponse
} from "codestream-agent";
import { NotificationType, RequestType, RequestType0 } from "vscode-languageserver-protocol";

export * from "codestream-agent";

export const ApiRequest = new RequestType<ApiRequestParams, any, void, void>("codeStream/api");
export const GitRepositoriesRequest = new RequestType0<GitRepositoriesResponse[], void, void>(
	"codeStream/git/repos"
);
export const DocumentMarkersRequest = new RequestType<
	DocumentMarkersRequestParams,
	DocumentMarkersResponse | undefined,
	void,
	void
>("codeStream/textDocument/markers");
export const DocumentPreparePostRequest = new RequestType<
	DocumentPreparePostRequestParams,
	DocumentPreparePostResponse,
	void,
	void
>("codeStream/textDocument/preparePost");
export const DocumentPostRequest = new RequestType<DocumentPostRequestParams, CSPost, void, void>(
	"codeStream/textDocument/post"
);
export const DidReceivePubNubMessagesNotification = new NotificationType<
	DidReceivePubNubMessagesNotificationParams[],
	void
>("codeStream/didReceivePubNubMessages");
