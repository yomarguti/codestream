"use strict";
import { CSTeam } from "../../agent/agentConnection";
import { CodeStreamSession } from "../session";
import { CodeStreamItem } from "./item";

export class Team extends CodeStreamItem<CSTeam> {
	constructor(session: CodeStreamSession, team: CSTeam) {
		super(session, team);
	}

	get name() {
		return this.entity.name;
	}
}
