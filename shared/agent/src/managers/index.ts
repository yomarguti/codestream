"use strict";

import { FetchFn, IdFn } from "./baseCache";
import { Id } from "./entityManager";
import { SequentialSlice } from "./sequentialSlice";

export enum IndexType {
	Unique = "unique",
	Group = "group",
	GroupSequential = "group-sequential"
}

export interface IndexParams<T> {
	type: IndexType;
	fields: (keyof T)[];
	seqField?: keyof T;
	fetchFn: FetchFn<T>;
	idFn?: IdFn<T>;
}

/**
 * Factory function to create indexes
 *
 * @param {IndexParams} params
 *
 * @return {Index} Index object
 */
export function makeIndex<T>(params: IndexParams<T>): Index<T> {
	switch (params.type) {
		case IndexType.Unique:
			return new UniqueIndex(params.fields, params.fetchFn);
		case IndexType.Group:
			return new GroupIndex(params.fields, params.fetchFn, params.idFn!);
		case IndexType.GroupSequential:
			return new GroupSequentialIndex(
				params.fields,
				params.seqField!,
				params.fetchFn,
				params.idFn!
			);
	}
}

export function encodeArray(array: any): string {
	array = Array.isArray(array) ? array : [array];
	return array.join("|");
}

function defaultIdFn(entity: any): Id {
	return entity.id;
}

abstract class BaseIndex<T> {
	protected constructor(readonly fields: (keyof T)[], readonly fetchFn: FetchFn<T>) {}

	abstract set(value: any, entity: T, oldEntity?: T): void;

	protected requireIndexValue(entity: T): string | undefined {
		const values = [];
		for (const field of this.fields) {
			const value = (entity as any)[field];
			if (value != null) {
				values.push(value);
			}
		}

		if (values.length === 0) return undefined;

		return encodeArray(values);
	}
}

/**
 * Index to search for entities by unique values like IDs or SSNs. Accepts
 * only entities with defined values for the key field.
 */
export class UniqueIndex<T> extends BaseIndex<T> {
	readonly type = IndexType.Unique;

	private readonly _data = new Map<string, any>();

	constructor(fields: (keyof T)[], fetchFn: FetchFn<T>) {
		super(fields, fetchFn);
	}

	set(entity: T, oldEntity?: T) {
		const value = this.requireIndexValue(entity);
		if (value === undefined) return;

		if (oldEntity) {
			const oldValue = this.requireIndexValue(oldEntity);
			if (oldValue !== undefined && oldValue !== value) {
				this._data.delete(oldValue);
			}
		}

		this._data.set(value, entity);
	}

	get(...value: any[]): T | undefined {
		return this._data.get(encodeArray(value));
	}

	getAll(): T[] {
		return Array.from(this._data.values());
	}

	has(...value: any[]): boolean {
		return this._data.has(encodeArray(value));
	}

	delete(...value: any[]) {
		this._data.delete(encodeArray(value));
	}
}

/**
 * Index to search for groups of entities with a common key like people with
 * the same last name, or posts with the same streamId.
 *
 * Each value group must be initialized independently via #initGroup. Getting
 * an uninitialized group will return undefined, and setting an entity before
 * its group is initialized results in no-op.
 */
export class GroupIndex<T> extends BaseIndex<T> {
	readonly type = IndexType.Group;

	private readonly groups = new Map<string, Map<Id, T>>();
	private readonly idFn: IdFn<T>;

	constructor(fields: (keyof T)[], fetchFn: FetchFn<T>, idFn?: IdFn<T>) {
		super(fields, fetchFn);
		this.idFn = idFn || defaultIdFn;
	}

	/**
	 * Returns a group of entities that share the same group value.
	 * If the group is not initialized, returns `undefined`.
	 *
	 * @param values The group value
	 * @return Array of entities or `undefined`
	 */
	getGroup(...values: any[]): T[] | undefined {
		const indexValue = encodeArray(values);
		const group = this.groups.get(indexValue);
		if (group) {
			return Array.from(group.values());
		} else {
			return;
		}
	}

	/**
	 * Add or update an entity. If the corresponding group is not initialized,
	 * results in no-op.
	 *
	 * @param entity The entity
	 * @param oldEntity If specified, removes entity from its old group if different
	 */
	set(entity: T, oldEntity?: T) {
		const group = this.getGroupForEntity(entity);

		if (oldEntity) {
			const oldGroup = this.getGroupForEntity(oldEntity);
			if (oldGroup && oldGroup !== group) {
				oldGroup.delete(this.idFn(oldEntity));
			}
		}

		if (group) {
			group.set(this.idFn(entity), entity);
		}
	}

	/**
	 * Initializes a group of entities
	 *
	 * @param {any[]} values The value of the group
	 * @param {[]} entities The entities
	 */
	initGroup(values: any[], entities: T[]) {
		const indexValue = encodeArray(values);
		if (this.groups.has(indexValue)) {
			return;
		}

		const group = new Map();
		for (const entity of entities) {
			group.set(this.idFn(entity), entity);
		}
		this.groups.set(indexValue, group);
	}

	private getGroupForEntity(entity: T): Map<Id, T> | undefined {
		const indexValue = this.requireIndexValue(entity);
		return indexValue === undefined ? undefined : this.groups.get(indexValue);
	}
}

class SequentialGroup<T> {
	private readonly data: T[] = [];

	private _maxSeq = 0;
	get maxSeq() {
		return this._maxSeq;
	}

	set(seqValue: number, entity: T) {
		this.data[seqValue] = entity;
		if (seqValue > this._maxSeq) {
			this._maxSeq = seqValue;
		}
	}

	dataSlice(startSeq: number, endSeq: number): T[] {
		return this.data.slice(startSeq, endSeq);
	}

	dataTail(limit: number): T[] {
		return this.data.slice(Math.max(this.data.length - limit, 1));
	}
}

export class GroupSequentialIndex<T> extends BaseIndex<T> {
	readonly type = IndexType.GroupSequential;
	private readonly groups = new Map<string, SequentialGroup<T>>();
	private readonly seqField: keyof T;
	private readonly idFn: IdFn<T>;

	constructor(field: (keyof T)[], seqField: keyof T, fetchFn: FetchFn<T>, idFn?: IdFn<T>) {
		super(field, fetchFn);
		this.seqField = seqField;
		this.idFn = idFn || defaultIdFn;
	}

	set(entity: T, oldEntity?: T) {
		const indexValue = this.requireIndexValue(entity);
		if (indexValue === undefined) return;

		const group = this.groups.get(indexValue);
		if (group) {
			const seqValue = this.requireSeqValue(entity);
			group.set(seqValue, entity);
		}
	}

	initGroup(values: any[], entities: T[]) {
		const indexValue = encodeArray(values);
		if (this.groups.has(indexValue)) {
			return;
		}

		const group = new SequentialGroup<T>();
		for (const entity of entities) {
			const seqValue = (entity as any)[this.seqField];
			if (typeof seqValue !== "number") {
				throw this.errSeqNonNumeric(this.idFn(entity), seqValue);
			}
			group.set(seqValue, entity);
		}
		this.groups.set(indexValue, group);
	}

	getGroupSlice(values: any[], seqStart: number, seqEnd: number): SequentialSlice<T> | undefined {
		const indexValue = encodeArray(values);
		const group = this.groups.get(indexValue);
		if (group) {
			const dataSlice = group.dataSlice(seqStart, seqEnd);
			return new SequentialSlice(dataSlice, this.seqField, seqStart, seqEnd, group.maxSeq);
		} else {
			return;
		}
	}

	getGroupTail(values: any[], limit: number): SequentialSlice<T> | undefined {
		const indexValue = encodeArray(values);
		const group = this.groups.get(indexValue);
		if (group) {
			const dataSlice = group.dataTail(limit);
			const last = dataSlice[dataSlice.length - 1];
			const lastSeq = last && (last as any)[this.seqField];

			let seqStart;
			let seqEnd;
			if (lastSeq) {
				seqEnd = lastSeq + 1;
				seqStart = seqEnd - dataSlice.length;
			} else {
				seqStart = 0;
				seqEnd = 1;
			}

			return new SequentialSlice(dataSlice, this.seqField, seqStart, seqEnd, group.maxSeq);
		} else {
			return;
		}
	}

	private requireSeqValue(entity: T): number {
		const seqValue = (entity as any)[this.seqField];
		if (typeof seqValue !== "number") {
			throw this.errSeqNonNumeric(this.idFn(entity), seqValue);
		}
		return seqValue;
	}

	private errSeqNonNumeric(id: Id, seqValue: any): Error {
		return new Error(
			`Cannot add entity with id=${id} to group sequential index ${
				this.fields
			}: value for sequence field ${
				this.seqField
			} should be a number, but is ${seqValue}:${typeof seqValue}`
		);
	}
}

export type Index<T> = UniqueIndex<T> | GroupIndex<T> | GroupSequentialIndex<T>;
