"use strict";
import { CSEntity } from "../../agent/agentConnection";
import { CodeStreamSession } from "../session";

export abstract class CodeStreamItem<TEntity extends CSEntity> {
	constructor(public readonly session: CodeStreamSession, protected readonly entity: TEntity) {}

	get id() {
		return this.entity.id;
	}
}
