import { WebviewContext, WebviewPanels } from "@codestream/protocols/webview";
import { AnyObject } from "@codestream/webview/utils";

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
	SetCurrentDocumentMarker = "@context/SetCurrentDocumentMarker",
	SetIssueProvider = "@context/SetIssueProvider",
	SetCodemarksFileViewStyle = "@context/SetCodemarksFileViewStyle",
	SetCodemarksShowArchived = "@context/SetCodemarksShowArchived",
	SetCodemarksShowResolved = "@context/SetCodemarksShowResolved",
	SetChannelsMuteAll = "@context/SetChannelsMuteAll",
	SetShowFeedbackSmiley = "@context/SetShowFeedbackSmiley",
	SetNewPostEntryPoint = "@context/SetNewPostEntryPoint",
	SetRoute = "@context/SetRoute"
}

export type PostEntryPoint = "Stream" | "Global Nav" | "Spatial View" | undefined;

export interface ContextState extends WebviewContext {
	channelFilter: string;
	channelsMuteAll: boolean;

	codemarkFileFilter: string; // TODO: specify types
	codemarkTypeFilter: string;
	codemarkColorFilter: string;

	codemarksFileViewStyle: "list" | "inline";
	codemarksShowArchived: boolean;
	codemarksShowResolved: boolean;

	issueProvider?: string;
	panelStack: (WebviewPanels | string)[];

	showFeedbackSmiley: boolean;

	newPostEntryPoint: PostEntryPoint;
	route: RouteState;
}

export enum Route {
	NewUser = "newUserEntry",
	Signup = "signup",
	Login = "login",
	ChatProviderSelection = "chatProviderSelection",
	SlackAuth = "slackAuth",
	MSTeamsAuth = "msTeamsAuth",
	JoinTeam = "joinTeam",
	EmailConfirmation = "emailConfirmation",
	TeamCreation = "teamCreation"
}

export interface RouteState {
	name: Route;
	params: AnyObject;
}
