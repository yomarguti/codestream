"use strict";
import { CodeStreamSession } from "../session";
import { CSEntity } from "../shared/api.protocol";
import { log } from "../system";
import { ManagerBase } from "./baseManager";
import { KeyValue } from "./cache/baseCache";
import { EntityCache } from "./cache/entityCache";

export type Id = string;

/**
 * Base class for entity managers.
 */
export abstract class EntityManagerBase<T extends CSEntity> extends ManagerBase<T> {
	protected readonly cache: EntityCache<T> = new EntityCache<T>({
		idxFields: this.getIndexedFields(),
		fetchFn: this.fetch.bind(this),
		entityName: this.getEntityName()
	});

	constructor(public readonly session: CodeStreamSession) {
		super(session);
	}

	getById(id: Id): Promise<T> {
		return this.cache.getById(id);
	}

	getByIdFromCache(id: Id): Promise<T | undefined> {
		return this.cache.getByIdFromCache(id);
	}

	protected fetch(criteria: KeyValue<T>[]): Promise<T> {
		const [idCriteria] = criteria;
		const id = idCriteria[1] as Id;
		return this.fetchById(id);
	}

	protected fetchCriteria(obj: T): KeyValue<T>[] {
		return [["id", obj.id]];
	}

	protected abstract fetchById(id: Id): Promise<T>;
}

export abstract class CachedEntityManagerBase<T extends CSEntity> extends EntityManagerBase<T> {
	protected _cached = false;
	protected _caching: Promise<void> | undefined;

	async ensureCached(): Promise<T[]> {
		if (!this._cached && this._caching === undefined) {
			// Don't pass the request, since we want to cache all the data
			this._caching = this.loadCache();
		}

		if (this._caching !== undefined) {
			void (await this._caching);
			this._cached = true;
			this._caching = undefined;
		}

		return this.cache.getAll();
	}

	@log()
	protected invalidateCache() {
		this._cached = false;
		super.invalidateCache();
	}

	protected abstract async loadCache(): Promise<void>;
}
