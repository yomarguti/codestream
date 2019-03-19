import { WebviewContext, WebviewPanels } from "@codestream/protocols/webview";

export enum ContextActionsType {
	SetCodemarkFileFilter = "@context/SetCodemarkFileFilter",
	SetCodemarkTypeFilter = "@context/SetCodemarkTypeFilter",
	SetCodemarkColorFilter = "@context/SetCodemarkColorFilter",
	SetChannelFilter = "@context/SetChannelFilter",
	SetContext = "@context/Set",
	OpenPanel = "@context/OpenPanel",
	ClosePanel = "@context/ClosePanel",
	SetFocusState = "@context/SetFocusState",
	SetCurrentStream = "@context/SetCurrentStream",
	SetIssueProvider = "@context/SetIssueProvider"
}

export interface State extends WebviewContext {
	codemarkFileFilter: string; // TODO: specify types
	codemarkTypeFilter: string;
	codemarkColorFilter: string;
	channelFilter: string;
	issueProvider?: string;
	panelStack: (WebviewPanels | string)[];
}
