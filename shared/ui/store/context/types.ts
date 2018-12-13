export enum ContextActionsType {
	SetThread = "SET_CURRENT_THREAD",
	SetCodeMarkFileFilter = "SET_CODEMARK_FILE_FILTER",
	SetCodemarkTypeFilter = "SET_CODEMARK_TYPE_FILTER",
	SetChannelFilter = "SET_CHANNEL_FILTER",
	SetContext = "SET_CONTEXT",
	OpenPanel = "SET_PANEL",
	ClosePanel = "CLOSE_PANEL",
	SetFocusState = "SET_HAS_FOCUS",
	SetCurrentFile = "SET_CURRENT_FILE",
	SetCurrentStream = "SET_CURRENT_STREAM"
}

export interface State {
	currentFile: string;
	mostRecentSourceFile: string;
	currentTeamId: string;
	currentCommit: string; // maybe delete
	currentStreamId: string;
	fileStreamId?: string;
	lastFileStreamId?: string;
	threadId: string | null;
	panelStack: string[];
	hasFocus: boolean;
	codemarkFileFilter: string; // TODO: specify types
	codemarkTypeFilter: string;
	channelFilter: string;
}
