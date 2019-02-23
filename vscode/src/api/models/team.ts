"use strict";
import { CSTeam } from "@codestream/protocols/api";
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
