"use strict";

import { encodeArray, Index, IndexParams, IndexType, makeIndex } from "./index";

import { Id } from "../entityManager";
import { SequentialSlice } from "./sequentialSlice";

export type UniqueFetchFn<T> = (value: any[]) => Promise<T | undefined>;
export type GroupFetchFn<T> = (value: any[]) => Promise<T[]>;
export type GroupSequentialFetchFn<T> = (
	groupValue: any[],
	seqStart?: number,
	seqEnd?: number,
	limit?: number
) => Promise<T[]>;
export type FetchFn<T> = UniqueFetchFn<T> | GroupFetchFn<T> | GroupSequentialFetchFn<T>;

export type IdFn<T> = (obj: T) => Id;

export type KeyValue<T> = [keyof T, any];

export function getKeys<T>(keyValues: KeyValue<T>[]): (keyof T)[] {
	return keyValues.map(kv => kv[0]);
}

export function getValues<T>(keyValues: KeyValue<T>[]): any[] {
	return keyValues.map(kv => kv[1]);
}

export class BaseCache<T> {
	protected readonly indexes: Map<string, Index<T>>;

	/**
	 * Create a cache
	 *
	 * @param idxFields Indexed fields
	 */
	constructor(idxFields: IndexParams<T>[]) {
		const indexes = new Map();
		for (const idxField of idxFields) {
			indexes.set(encodeArray(idxField.fields), makeIndex(idxField));
		}
		this.indexes = indexes;
	}

	/**
	 * Get an entity by field. Requires an unique index.
	 *
	 * @param criteria Search criteria as an array of key/value tuples
	 *
	 * @return Entity or `undefined`
	 */
	async get(
		criteria: KeyValue<T>[],
		options: { avoidFetch?: boolean } = {}
	): Promise<T | undefined> {
		const keys = getKeys(criteria);
		const index = this.getIndex(keys);
		const values = getValues(criteria);
		if (!index || index.type !== IndexType.Unique) {
			throw new Error(`No unique index declared for fields ${keys}`);
		}

		let entity = index.get(values);
		if (!entity && options.avoidFetch !== true) {
			const fetch = index.fetchFn as UniqueFetchFn<T>;
			entity = await fetch(criteria);
			this.set(entity);
		}
		return entity;
	}

	/**
	 * Add or update an entity. All initialized indexes are updated. In order to dissociate an
	 * updated entity from its old indexed values, #oldEntity must be specified.
	 *
	 * @param entity The entity
	 * @param oldEntity The old version of the entity
	 */
	set(entities: T[]): void;
	set(entity?: T, oldEntity?: T): void;
	set(entitiesOrEntity?: T | T[], oldEntity?: T): void {
		if (!entitiesOrEntity) {
			return;
		}

		if (Array.isArray(entitiesOrEntity)) {
			for (const entity of entitiesOrEntity) {
				if (!entity) continue;

				for (const index of this.indexes.values()) {
					index.set(entity);
				}
			}
		} else {
			for (const index of this.indexes.values()) {
				index.set(entitiesOrEntity, oldEntity);
			}
		}
	}

	/**
	 * Get a group of entities by field. Requires a group index.
	 *
	 * @param criteria Search criteria as an array of key/value tuples
	 *
	 * @return Array of entities or `undefined` if group is not initialized
	 */
	async getGroup(criteria: KeyValue<T>[]): Promise<T[]> {
		const keys = getKeys(criteria);
		const values = getValues(criteria);
		const index = this.getIndex(keys);
		if (!index || index.type !== IndexType.Group) {
			throw new Error(`No group index declared for field ${keys}`);
		}

		const entities = index.getGroup(values);
		if (!entities) {
			const fetch = index.fetchFn as GroupFetchFn<T>;
			const entities = await fetch(criteria);
			this.initGroup(criteria, entities);
			return entities;
		}
		return entities;
	}

	/**
	 * Get a slice of a group of entities. Returned array will contain entities in the specified
	 * group with sequences from seqStart to seqEnd-1. Requires a group-sequential index.
	 *
	 * @param criteria Search criteria as an array of key/value tuples
	 * @param seqStart The starting sequence
	 * @param seqEnd The ending sequence
	 *
	 * @return {SequentialSlice} of entities or `undefined` if group is not initialized
	 */
	async getGroupSlice(
		criteria: KeyValue<T>[],
		seqStart: number,
		seqEnd: number
	): Promise<SequentialSlice<T>> {
		const keys = getKeys(criteria);
		const values = getValues(criteria);
		const index = this.getIndex(keys);
		if (!index || index.type !== IndexType.GroupSequential) {
			throw new Error(`No group-sequential index declared for field ${keys}`);
		}

		const slice = index.getGroupSlice(values, seqStart, seqEnd);
		if (slice) {
			await this.fillSliceGaps(slice, criteria);
			return slice;
		} else {
			const fetchFn = index.fetchFn as GroupSequentialFetchFn<T>;
			const entities = await fetchFn(values, undefined, undefined, 1);
			this.initGroup(criteria, entities);
			return this.getGroupSlice(criteria, seqStart, seqEnd);
		}
	}

	/**
	 * Get the tail (trailing slice) of a group of entities. Returned array will contain `n`
	 * elements as specified via #limit parameter, unless the whole group contain less than `n`
	 * entities. Requires a group-sequential index.
	 *
	 * @param criteria Search criteria as an array of key/value tuples
	 * @param limit Maximum number of entities to be included in the result
	 *
	 * @return {SequentialSlice} of entities or `undefined` if group is not initialized
	 */
	async getGroupTail(criteria: KeyValue<T>[], limit: number): Promise<SequentialSlice<T>> {
		const keys = getKeys(criteria);
		const values = getValues(criteria);
		const index = this.getIndex(keys);
		if (!index || index.type !== IndexType.GroupSequential) {
			throw new Error(`No group-sequential index declared for field ${keys}`);
		}

		const tail = index.getGroupTail(values, limit);
		if (tail) {
			await this.fillSliceGaps(tail, criteria);
			return tail;
		} else {
			const fetchFn = index.fetchFn as GroupSequentialFetchFn<T>;
			const entities = await fetchFn(values, undefined, undefined, limit);
			this.initGroup(criteria, entities);
			return this.getGroupTail(criteria, limit);
		}
	}

	/**
	 * Initializes a group of entities. For group indexes, all entities must be specified. For
	 * group-sequential indexes, the trailing (last sequences) entities must be specified.
	 *
	 * @param groupField The group field
	 * @param groupValue The group field value
	 * @param entities Array of entities
	 */
	initGroup(criteria: KeyValue<T>[], entities: T[]) {
		const keys = getKeys(criteria);
		const values = getValues(criteria);
		const index = this.requireIndex(keys);
		if (index.type !== IndexType.Group && index.type !== IndexType.GroupSequential) {
			throw new Error(
				`Cannot initialize group ${keys}=${values} because it doesn't have an associated group or group-sequential index`
			);
		}

		for (const entity of entities) {
			this.set(entity);
		}
		index.initGroup(values, entities);
	}

	private async fillSliceGaps(slice: SequentialSlice<T>, criteria: KeyValue<T>[]) {
		const keys = getKeys(criteria);
		const values = getValues(criteria);
		const index = this.getIndex(keys)!;
		const fetch = index.fetchFn as GroupSequentialFetchFn<T>;
		const gaps = slice.getSequenceGaps();
		for (const gap of gaps) {
			const entities = await fetch(criteria, gap.start, gap.end);
			for (const entity of entities) {
				this.set(entity);
			}
			slice.add(entities);
		}
	}

	private requireIndex(keys: (keyof T)[]): Index<T> {
		const index = this.getIndex(keys);
		if (index == null) {
			throw new Error(`No index declared for field ${keys}`);
		}
		return index;
	}

	private getIndex(fields: (keyof T)[]): Index<T> | undefined {
		return this.indexes.get(encodeArray(fields));
	}
}
