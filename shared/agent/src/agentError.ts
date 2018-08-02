"use strict";

export class AgentError extends Error {
	info: any = {};

	constructor(message: string, info: any = {}) {
		super(message);
		this.info = info;
	}
}

export class ServerError extends AgentError {
	statusCode: number | undefined;

	constructor(message: string, info: any = {}, statusCode?: number) {
		super(message, info);
		this.statusCode = statusCode;
	}
}
