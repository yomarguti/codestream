"use strict";
import { TraceLevel } from "./logger";

export enum Notifications {
	All = "all",
	Mentions = "mentions",
	None = "none"
}

export interface Config {
	autoHideMarkers: boolean;
	autoSignIn: boolean;
	email: string;
	notifications: Notifications;
	serverUrl: string;
	showAvatars: boolean;
	showInStatusBar: "left" | "right" | false;
	showMarkerCodeLens: boolean;
	showMarkerGlyphs: boolean;
	showShortcutTipOnSelection: boolean;
	team: string;
	traceLevel: TraceLevel;
	webAppUrl: string;
}
