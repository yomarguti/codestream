"use strict";
import { RawRTMessage } from "../api/apiProvider";
import { CodeStreamSession } from "../session";
import { debug, log } from "../system";
import { IndexParams } from "./cache";
import { BaseCache, KeyValue } from "./cache/baseCache";
import * as operations from "./operations";
import { isCompleteObject } from "./operations";

export abstract class ManagerBase<T> {
	protected readonly cache: BaseCache<T> = new BaseCache<T>({
		idxFields: this.getIndexedFields(),
		entityName: this.getEntityName()
	});

	public constructor(public readonly session: CodeStreamSession) {
		this.session.onDidRequestReset(() => {
			this.invalidateCache();
		});

		this.initialize();
	}

	protected initialize() {}

	getIndexedFields(): IndexParams<T>[] {
		return [];
	}

	protected abstract getEntityName(): string;

	protected abstract fetch(criteria: KeyValue<T>[]): Promise<T>;

	protected abstract fetchCriteria(obj: T): KeyValue<T>[];

	@log()
	protected invalidateCache() {
		this.cache.invalidate();
	}

	@debug()
	async resolve(message: RawRTMessage): Promise<T[]> {
		const resolved = await Promise.all(
			message.data.map(async (data: any) => {
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
		return this.cache.get(criteria, { fromCacheOnly: true });
	}

	cacheSet(entity: T, oldEntity?: T) {
		this.cache.set(entity, oldEntity);
	}
}
