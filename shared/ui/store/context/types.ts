import { WebviewContext } from "@codestream/protocols/webview";
import { GetRangeScmInfoResponse } from "@codestream/protocols/agent";

export enum ContextActionsType {
	SetThread = "@context/SetThread",
	SetCodemarkFileFilter = "@context/SetCodemarkFileFilter",
	SetCodemarkTypeFilter = "@context/SetCodemarkTypeFilter",
	SetCodemarkColorFilter = "@context/SetCodemarkColorFilter",
	SetChannelFilter = "@context/SetChannelFilter",
	SetContext = "@context/Set",
	OpenPanel = "@context/OpenPanel",
	ClosePanel = "@context/ClosePanel",
	SetFocusState = "@context/SetFocusState",
	SetCurrentFile = "@context/SetCurrentFile",
	SetCurrentStream = "@context/SetCurrentStream",
	SetIssueProvider = "@context/SetIssueProvider"
}

export interface State extends WebviewContext {
	codemarkFileFilter: string; // TODO: specify types
	codemarkTypeFilter: string;
	codemarkColorFilter: string;
	channelFilter: string;
	issueProvider?: string;
	panelStack: string[];

	scm?: GetRangeScmInfoResponse;
}
