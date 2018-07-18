"use strict";

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
	email: string;
	notifications: Notifications;
	password: string;
	serverUrl: string;
	team: string;
	traceLevel: TraceLevel;
}
