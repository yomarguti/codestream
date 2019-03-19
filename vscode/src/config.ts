"use strict";
import { TraceLevel } from "./logger";

export enum MarkerStyle {
	Glyphs = "glyphs",
	CodeLens = "codelens"
}

export enum Notifications {
	All = "all",
	Mentions = "mentions",
	None = "none"
}

export interface Config {
	autoSignIn: boolean;
	avatars: boolean;
	email: string;
	markerStyle: MarkerStyle;
	muteAll: boolean;
	notifications: Notifications;
	serverUrl: string;
	showInStatusBar: "left" | "right" | false;
	showMarkers: boolean;
	showFeedbackSmiley: boolean;
	showShortcutTipOnSelection: boolean;
	team: string;
	traceLevel: TraceLevel;
	viewCodemarksInline: boolean;
	webAppUrl: string;
}
