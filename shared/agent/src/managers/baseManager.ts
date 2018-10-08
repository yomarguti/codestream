"use strict";

import { CodeStreamApiProvider } from "../api/codestreamApi";
import { CodeStreamSession } from "../session";
import { LspHandler } from "../system/decorators";
import { BaseCache, KeyValue } from "./baseCache";
import { IndexParams } from "./index";
import * as operations from "./operations";
import {
	CodeStreamRTEMessage,
	MessageSource,
	RealTimeMessage,
	SlackRTEMessage
} from "./realTimeMessage";

export abstract class BaseManager<T> {
	protected readonly cache: BaseCache<T> = new BaseCache<T>(this.getIndexedFields());

	public constructor(public session: CodeStreamSession) {
		const handlerRegistry = (this as any).handlerRegistry as LspHandler[] | undefined;
		if (handlerRegistry !== undefined) {
			for (const handler of handlerRegistry) {
				this.session.agent.registerHandler(handler.type, handler.method.bind(this));
			}
		}

		this.init();
	}

	protected init() {}

	getIndexedFields(): IndexParams<T>[] {
		return [];
	}

	protected abstract fetch(criteria: KeyValue<T>[]): Promise<T>;

	protected abstract fetchCriteria(obj: T): KeyValue<T>[];

	resolve(realTimeMessage: RealTimeMessage): Promise<T[]> {
		switch (realTimeMessage.source) {
			case MessageSource.CodeStream:
				return this.resolvePubNubMessage(realTimeMessage);
			case MessageSource.Slack:
				return this.resolveSlackMessage(realTimeMessage);
		}
	}

	async resolvePubNubMessage(message: CodeStreamRTEMessage): Promise<T[]> {
		const resolved = await Promise.all(
			message.changeSets.map(async c => {
				const changes = CodeStreamApiProvider.normalizeResponse(c) as { [key: string]: any };
				const criteria = this.fetchCriteria(changes as T);
				const cached = await this.cacheGet(criteria);
				if (cached) {
					const updatedEntity = operations.resolve(cached as any, changes);
					this.cacheSet(updatedEntity as T, cached);
					return updatedEntity as T;
				} else {
					// TODO ignore unfetched entities unless they are new, using .version
					const entity = await this.fetch(criteria);
					if (entity) {
						this.cacheSet(entity);
						return entity;
					}
					return undefined;
				}
			})
		);
		return resolved.filter(Boolean) as T[];
	}

	async resolveSlackMessage(message: SlackRTEMessage): Promise<T[]> {
		return [];
	}

	cacheGet(criteria: KeyValue<T>[]): Promise<T | undefined> {
		return this.cache.get(criteria, { avoidFetch: true });
	}

	cacheSet(entity: T, oldEntity?: T) {
		this.cache.set(entity, oldEntity);
	}
}
