import { WebviewContext, WebviewPanels } from "@codestream/protocols/webview";
import { ThirdPartyProviderConfig } from "@codestream/protocols/agent";

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
	SetIssueProvider = "@context/SetIssueProvider",
	SetCodemarksFileViewStyle = "@context/SetCodemarksFileViewStyle",
	SetCodemarksShowArchived = "@context/SetCodemarksShowArchived",
	SetCodemarksShowResolved = "@context/SetCodemarksShowResolved",
	SetChannelsMuteAll = "@context/SetChannelsMuteAll",
	SetShowFeedbackSmiley = "@context/SetShowFeedbackSmiley"
}

export interface State extends WebviewContext {
	channelFilter: string;
	channelsMuteAll: boolean;

	codemarkFileFilter: string; // TODO: specify types
	codemarkTypeFilter: string;
	codemarkColorFilter: string;

	codemarksFileViewStyle: "list" | "inline";
	codemarksShowArchived: boolean;
	codemarksShowResolved: boolean;

	issueProvider?: ThirdPartyProviderConfig;
	panelStack: (WebviewPanels | string)[];

	showFeedbackSmiley: boolean;
}
