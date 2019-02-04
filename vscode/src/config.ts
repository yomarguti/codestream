"use strict";
import { TraceLevel } from "./logger";

export enum MarkerStyle {
	Bubble = "bubble",
	Logo = "logo",
	Squircle = "squircle",
	Triangle = "triangle"
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
	notifications: Notifications;
	serverUrl: string;
	showInStatusBar: "left" | "right" | false;
	showMarkers: boolean;
	openCommentOnSelect: boolean;
	muteAll: boolean;
	viewCodemarksInline: boolean;
	team: string;
	traceLevel: TraceLevel;
	webAppUrl: string;
}
