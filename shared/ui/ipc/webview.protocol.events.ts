import { RequestType } from "vscode-languageserver-protocol";
// import { State as ContextState } from "../store/context/types";
type ContextState = any;

export const WebviewReadyNotificationType = new RequestType<void, void, void, void>(
	"extension/view-ready"
);

export interface DidChangeActiveStreamNotification {
	streamId?: string;
}

export const DidChangeActiveStreamNotificationType = new RequestType<
	DidChangeActiveStreamNotification,
	void,
	void,
	void
>("extension/changed-active-stream");

export interface DidOpenThreadNotification {
	streamId: string;
	threadId?: string;
}
export const DidOpenThreadNotificationType = new RequestType<
	DidOpenThreadNotification,
	void,
	void,
	void
>("extension/thread-opened");

export interface DidCloseThreadNotification {
	threadId?: string;
}

export const DidCloseThreadNotificationType = new RequestType<
	DidCloseThreadNotification,
	void,
	void,
	void
>("extension/thread-closed");

export interface DidChangeContextStateNotification {
	state: ContextState;
}
export const DidChangeContextStateNotificationType = new RequestType<
	DidChangeContextStateNotification,
	void,
	void,
	void
>("extension/context-state-changed");
