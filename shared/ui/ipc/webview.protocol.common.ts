import { GetFileScmInfoResponse } from "@codestream/protocols/agent";
import { Position, Range } from "vscode-languageserver-types";
import { EditorSelection } from "./webview.protocol";

export const MaxRangeValue = 2147483647;

export interface EditorMargins {
	top?: number;
	right?: number;
	bottom?: number;
	left?: number;
}

export enum EditorScrollMode {
	Pixels = "pixels",
	Lines = "lines"
}

export interface EditorMetrics {
	fontSize?: number;
	lineHeight?: number;
	margins?: EditorMargins;
	scrollMode?: EditorScrollMode;
	scrollRatio?: number;
}

export interface EditorSelection extends Range {
	// MUST be identical to Range.end
	cursor: Position;
}

export enum WebviewPanels {
	Activity = "activity",
	Codemarks = "knowledge",
	CodemarksForFile = "codemarks-for-file",
	Invite = "invite",
	People = "people",
	Person = "person",
	Tasks = "tasks",
	Notifications = "notifications",
	NewComment = "new-comment",
	NewIssue = "new-issue",
	ComposeReview = "compose-review",
	Review = "review",
	Reviews = "reviews"
}

export interface WebviewContext {
	currentTeamId: string;
	currentStreamId?: string;
	threadId?: string;
	currentCodemarkId?: string;
	currentReviewId?: string;
	activeReviewId?: string;
	currentMarkerId?: string;
	isRepositioning?: boolean;
	hasFocus: boolean;
	panelStack?: (WebviewPanels | string)[];
}

export interface SessionState {
	otc?: string;
	userId?: string;
	inMaintenanceMode?: boolean;
}

export interface EditorContext {
	scmInfo?: GetFileScmInfoResponse;
	activeFile?: string;
	lastActiveFile?: string;
	textEditorVisibleRanges?: Range[];
	textEditorUri?: string;
	textEditorSelections?: EditorSelection[];
	metrics?: EditorMetrics;
	textEditorLineCount?: number;
}

export interface WebviewConfigs {
	showHeadshots: boolean;
	debug: boolean;
	email?: string;
	serverUrl: string;
	team?: string;
}

export interface IpcHost {
	postMessage<R>(message: WebviewIpcMessage, targetOrgigin: string, transferable?: any): Promise<R>;
	postMessage<R>(message: WebviewIpcMessage): Promise<R>;
	onmessage: any;
}

declare function acquireCodestreamHost(): IpcHost;

let host: IpcHost;
export const findHost = (): IpcHost => {
	if (host) return host;
	try {
		host = acquireCodestreamHost();
	} catch (e) {
		throw new Error("Host needs to provide global `acquireCodestreamHost` function");
	}
	return host;
};

export enum IpcRoutes {
	Agent = "codestream",
	Host = "host",
	Webview = "webview"
}

export interface WebviewIpcNotificationMessage {
	method: string;
	params?: any;
}

export interface WebviewIpcRequestMessage {
	id: string;
	method: string;
	params?: any;
}

export interface WebviewIpcResponseMessage {
	id: string;
	params?: any;
	error?: any;
}

export type WebviewIpcMessage =
	| WebviewIpcNotificationMessage
	| WebviewIpcRequestMessage
	| WebviewIpcResponseMessage;

// Don't use as for some reason it isn't a valid type guard
// export function isIpcNotificationMessage(
// 	msg: WebviewIpcMessage
// ): msg is WebviewIpcNotificationMessage {
// 	return (msg as any).method != null && (msg as any).id == null;
// }

export function isIpcRequestMessage(msg: WebviewIpcMessage): msg is WebviewIpcRequestMessage {
	return (msg as any).method != null && (msg as any).id != null;
}

export function isIpcResponseMessage(msg: WebviewIpcMessage): msg is WebviewIpcResponseMessage {
	return (msg as any).method == null && (msg as any).id != null;
}
