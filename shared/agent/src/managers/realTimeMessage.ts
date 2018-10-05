"use strict";

import { MessageType } from "../shared/agent.protocol";

export enum MessageSource {
	CodeStream = "codestream",
	Slack = "slack"
}

export interface CodeStreamRTEMessage {
	source: MessageSource.CodeStream;
	type: MessageType;
	changeSets: { [key: string]: any }[];
}

export interface SlackRTEMessage {
	source: MessageSource.Slack;
	type: MessageType;
	// ?????
}

export type RealTimeMessage = CodeStreamRTEMessage | SlackRTEMessage;
