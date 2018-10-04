"use strict";

import { Emitter, Event } from "vscode-languageserver";
import { CodeStreamApi } from "../api/api";
import { CSEntity } from "../shared/api.protocol";
import { Cache } from "./cache";
import { IndexType, makeIndex } from "./index";
import * as operations from "./operations";
import { SequentialSlice } from "./sequentialSlice";

export type Id = string;

export interface IndexedField<T extends CSEntity> {
	type: IndexType;
	field: keyof T;
	seqField?: keyof T;
	fetchFn: FetchFn<T>;
}

type UniqueFetchFn<T extends CSEntity> = (value: any) => Promise<T | undefined>;
type GroupFetchFn<T extends CSEntity> = (value: any) => Promise<T[]>;
type GroupSequentialFetchFn<T extends CSEntity> = (
	groupValue: any,
	seqStart?: number,
	seqEnd?: number,
	limit?: number
) => Promise<T[]>;
type FetchFn<T extends CSEntity> = UniqueFetchFn<T> | GroupFetchFn<T> | GroupSequentialFetchFn<T>;

/**
 * Base class for entity managers.
 */
export abstract class EntityManager<T extends CSEntity> {
	protected readonly cache: Cache<T>;
	protected readonly fetchFns: Map<keyof T, FetchFn<T>>;

	protected abstract async fetch(id: Id): Promise<T>;

	protected abstract getIndexedFields(): IndexedField<T>[];

	public constructor() {
		const indexes = new Map();
		const fetchFns = new Map();
		for (const idxField of this.getIndexedFields()) {
			indexes.set(idxField.field, makeIndex(idxField));
			fetchFns.set(idxField.field, idxField.fetchFn);
		}
		this.cache = new Cache<T>(indexes);
		this.fetchFns = fetchFns;
	}

	private _onEntitiesChanged = new Emitter<T[]>();
	get onEntitiesChanged(): Event<T[]> {
		return this._onEntitiesChanged.event;
	}

	/**
	 * Retrieve an entity by Id
	 *
	 * @param {Id} id Id
	 *
	 * @return Entity
	 */
	async get(id: Id): Promise<T> {
		let entity = this.cache.get(id);
		if (!entity) {
			entity = await this.fetch(id);
			this.cache.set(entity);
		}
		return entity;
	}

	/**
	 * Retrieve an entity by unique field value.
	 * Requires Unique index.
	 *
	 * @param {Field} field The field
	 * @param {any} value The value
	 *
	 * @return Entity
	 */
	async getBy(field: keyof T, value: any): Promise<T | undefined> {
		const entity = this.cache.getBy(field, value);
		if (entity !== undefined) {
			return entity;
		} else {
			const fetchFn = this.fetchFn(field) as UniqueFetchFn<T>;
			const entity = await fetchFn(value);
			if (entity) {
				// FIXME - maybe we should set absent entities as null, as they are a valid search result
				this.cache.set(entity);
			}
			return entity;
		}
	}

	/**
	 * Retrieve a group of entities by group field value.
	 * Requires Group index.
	 *
	 * @param groupField The field
	 * @param groupValue The value
	 *
	 * @return Entity[]
	 */
	async getManyBy(groupField: keyof T, groupValue: any): Promise<T[]> {
		const group = this.cache.getManyBy(groupField, groupValue);
		if (group) {
			return group;
		} else {
			const fetchFn = this.fetchFn(groupField) as GroupFetchFn<T>;
			const entities = await fetchFn(groupValue);
			this.cache.initGroup(groupField, groupValue, entities);
			return entities;
		}
	}

	/**
	 * Retrieve a slice of a group of entities by group field value and
	 * range of sequence numbers.
	 * Requires group-sequential index.
	 *
	 * @param groupField The field
	 * @param groupValue The value
	 * @param seqStart Starting sequence
	 * @param seqEnd Ending sequence
	 *
	 * @return {SequentialSlice}
	 */
	async getGroupSlice(
		groupField: keyof T,
		groupValue: any,
		seqStart: number,
		seqEnd: number
	): Promise<SequentialSlice<T>> {
		const slice = this.cache.getGroupSlice(groupField, groupValue, seqStart, seqEnd);
		if (slice) {
			await this.fillSliceGaps(slice, groupField, groupValue);
			return slice;
		} else {
			const fetchFn = this.fetchFn(groupField) as GroupSequentialFetchFn<T>;
			const entities = await fetchFn(groupValue, undefined, undefined, 1);
			this.cache.initGroup(groupField, groupValue, entities);
			return await this.getGroupSlice(groupField, groupValue, seqStart, seqEnd);
		}
	}

	/**
	 * Retrieve the tail of a group of entities by group field value.
	 * Requires group-sequential index.
	 *
	 * @param groupField The field
	 * @param groupValue The value
	 * @param limit Maximum number of entities
	 *
	 * @return {SequentialSlice}
	 */
	async getGroupTail(
		groupField: keyof T,
		groupValue: any,
		limit: number
	): Promise<SequentialSlice<T>> {
		const tail = this.cache.getGroupTail(groupField, groupValue, limit);
		if (tail) {
			await this.fillSliceGaps(tail, groupField, groupValue);
			return tail;
		} else {
			const fetchFn = this.fetchFn(groupField) as GroupSequentialFetchFn<T>;
			const entities = await fetchFn(groupValue, undefined, undefined, limit);
			this.cache.initGroup(groupField, groupValue, entities);
			return await this.getGroupTail(groupField, groupValue, limit);
		}
	}

	protected async fillSliceGaps(slice: SequentialSlice<T>, groupField: keyof T, groupValue: any) {
		const fetchFn = this.fetchFn(groupField) as GroupSequentialFetchFn<T>;
		const gaps = slice.getSequenceGaps();
		for (const gap of gaps) {
			const entities = await fetchFn(groupValue, gap.start, gap.end);
			for (const entity of entities) {
				this.cache.set(entity);
			}
			slice.add(entities);
		}
	}

	protected fetchFn(field: keyof T): FetchFn<T> {
		const fetchFn = this.fetchFns.get(field);
		if (!fetchFn) {
			throw new Error(`No fetch function declared for field ${field}`);
		}
		return fetchFn;
	}

	async resolve(changeSets: object[]) {
		const resolved = await Promise.all(
			changeSets.map(async c => {
				const changes = CodeStreamApi.normalizeResponse(c) as { [key: string]: any };
				const cached = this.cache.get(changes["id"]);
				if (cached) {
					const updatedEntity = operations.resolve(cached as any, changes);
					this.cache.set(updatedEntity as T, cached);
					return updatedEntity as T;
				} else {
					// TODO ignore unfetched entities unless they are new, using .version
					const entity = await this.fetch(changes["id"]);
					if (entity) {
						this.cache.set(entity);
						return entity;
					}
					return undefined;
				}
			})
		);
		const entities = resolved.filter(Boolean) as T[];
		this._onEntitiesChanged.fire(entities);
	}
}
