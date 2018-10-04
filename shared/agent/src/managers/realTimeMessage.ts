"use strict";

import { MessageType } from "../shared/agent.protocol";

export enum MessageSource {
	PubNub,
	Slack
}

export interface PubNubMessage {
	source: MessageSource.PubNub;
	type: MessageType;
	changeSets: object[];
}

export interface SlackMessage {
	source: MessageSource.Slack;
	type: MessageType;
	// ?????
}

export type RealTimeMessage = PubNubMessage | SlackMessage;
