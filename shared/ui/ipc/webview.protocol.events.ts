import { NotificationType } from "./webview.protocol.common";

// import { State as ContextState } from "../store/context/types";
type ContextState = any;

export const WebviewReadyNotificationType = new NotificationType<void, void>(
	"extension/view-ready"
);

export interface DidChangeActiveStreamNotification {
	streamId?: string;
}

export const DidChangeActiveStreamNotificationType = new NotificationType<
	DidChangeActiveStreamNotification,
	void
>("extension/changed-active-stream");

export interface DidOpenThreadNotification {
	streamId: string;
	threadId?: string;
}
export const DidOpenThreadNotificationType = new NotificationType<DidOpenThreadNotification, void>(
	"extension/thread-opened"
);

export interface DidCloseThreadNotification {
	threadId?: string;
}

export const DidCloseThreadNotificationType = new NotificationType<
	DidCloseThreadNotification,
	void
>("extension/thread-closed");

export interface DidChangeContextStateNotification {
	state: ContextState;
}
export const DidChangeContextStateNotificationType = new NotificationType<
	DidChangeContextStateNotification,
	void
>("extension/context-state-changed");
