"use strict";
import { RTMessage } from "../api/apiProvider";
import { CodeStreamSession } from "../session";
import { LspHandler } from "../system/decorators";
import { BaseCache, KeyValue } from "./baseCache";
import { IndexParams } from "./index";
import * as operations from "./operations";
import { isCompleteObject } from "./operations";

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

	async resolve(message: RTMessage): Promise<T[]> {
		const resolved = await Promise.all(
			message.data.map(async data => {
				const criteria = this.fetchCriteria(data as T);
				const cached = await this.cacheGet(criteria);
				if (cached) {
					const updatedEntity = operations.resolve(cached as any, data);
					this.cacheSet(updatedEntity as T, cached);
					return updatedEntity as T;
				} else {
					let entity;
					if (isCompleteObject(data)) {
						entity = data as T;
					} else {
						entity = await this.fetch(criteria);
					}
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

	cacheGet(criteria: KeyValue<T>[]): Promise<T | undefined> {
		return this.cache.get(criteria, { avoidFetch: true });
	}

	cacheSet(entity: T, oldEntity?: T) {
		this.cache.set(entity, oldEntity);
	}
}
