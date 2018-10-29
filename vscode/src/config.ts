"use strict";

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

export enum TraceLevel {
	Silent = "silent",
	Errors = "errors",
	Verbose = "verbose",
	Debug = "debug"
}

export interface Config {
	autoSignIn: boolean;
	avatars: boolean;
	email: string;
	markerStyle: MarkerStyle;
	notifications: Notifications;
	serverUrl: string;
	showInStatusBar: "left" | "right" | false;
	showMarkers: boolean;
	muteAll: boolean;
	team: string;
	traceLevel: TraceLevel;
	webAppUrl: string;
}
