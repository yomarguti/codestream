export enum ContextActionsType {
	SetThread = "SET_CURRENT_THREAD",
	SetCodemarkFileFilter = "SET_CODEMARK_FILE_FILTER",
	SetCodemarkTypeFilter = "SET_CODEMARK_TYPE_FILTER",
	SetCodemarkColorFilter = "SET_CODEMARK_COLOR_FILTER",
	SetChannelFilter = "SET_CHANNEL_FILTER",
	SetContext = "SET_CONTEXT",
	OpenPanel = "SET_PANEL",
	ClosePanel = "CLOSE_PANEL",
	SetFocusState = "SET_HAS_FOCUS",
	SetCurrentFile = "SET_CURRENT_FILE",
	SetCurrentStream = "SET_CURRENT_STREAM",
	SetIssueProvider = "SET_ISSUE_PROVIDER"
}

export interface State {
	activeFile?: string;
	lastActiveFile?: string;
	currentTeamId: string;
	currentCommit: string; // maybe delete
	currentStreamId?: string;
	issueProvider?: string;
	fileStreamId?: string;
	lastFileStreamId?: string;
	threadId: string | null;
	panelStack: string[];
	hasFocus: boolean;
	codemarkFileFilter: string; // TODO: specify types
	codemarkTypeFilter: string;
	codemarkColorFilter: string;
	channelFilter: string;
	textEditorVisibleRanges: Range[];
	textEditorUri: string;
}
