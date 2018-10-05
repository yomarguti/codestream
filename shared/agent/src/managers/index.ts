"use strict";

import { CSEntity } from "../shared/api.protocol";
import { Id } from "./managers";
import { SequentialSlice } from "./sequentialSlice";

export enum IndexType {
	Unique = "unique",
	Group = "group",
	GroupSequential = "group-sequential"
}

interface MakeIndexParams<T extends CSEntity> {
	type: IndexType;
	field: keyof T;
	seqField?: keyof T;
}

/**
 * Factory function to create indexes
 *
 * @param {MakeIndexParams} params
 *
 * @return {Index} Index object
 */
export function makeIndex<T extends CSEntity>(params: MakeIndexParams<T>): Index<T> {
	switch (params.type) {
		case IndexType.Unique:
			return new UniqueIndex(params.field);
		case IndexType.Group:
			return new GroupIndex(params.field);
		case IndexType.GroupSequential:
			return new GroupSequentialIndex(params.field, params.seqField!);
	}
}

function ensureArray<T>(data: T | T[]): T[] {
	if (!Array.isArray(data)) {
		data = [data];
	}
	return data;
}

abstract class BaseIndex<T extends CSEntity> {
	protected constructor(protected readonly field: keyof T) {}

	abstract set(value: any, entity: T, oldEntity?: T): void;

	requireIndexValue(entity: T): any {
		const value = (entity as any)[this.field];
		if (value == null) {
			throw new Error(
				`Entity id=${entity.id} cannot be indexed by ${
					this.field
				} because it lacks a value for this field`
			);
		}
		return value;
	}
}

/**
 * Index to search for entities by unique values like IDs or SSNs. Accepts
 * only entities with defined values for the key field.
 */
export class UniqueIndex<T extends CSEntity> extends BaseIndex<T> {
	readonly type = IndexType.Unique;

	private readonly _data = new Map<any, T>();

	constructor(field: keyof T) {
		super(field);
	}

	set(entity: T, oldEntity?: T) {
		const value = this.requireIndexValue(entity);

		if (oldEntity) {
			const oldValue = this.requireIndexValue(oldEntity);
			if (oldValue !== value) {
				this._data.delete(oldValue);
			}
		}

		this._data.set(value, entity);
	}

	get(value: any): T | undefined {
		return this._data.get(value);
	}

	has(value: any): boolean {
		return this._data.has(value);
	}

	delete(value: any) {
		this._data.delete(value);
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
export class GroupIndex<T extends CSEntity> extends BaseIndex<T> {
	readonly type = IndexType.Group;

	private readonly groups = new Map<any, Map<Id, T>>();

	constructor(groupField: keyof T) {
		super(groupField);
	}

	/**
	 * Returns a group of entities that share the same group value.
	 * If the group is not initialized, returns `undefined`.
	 *
	 * @param groupValue The group value
	 * @return Array of entities or `undefined`
	 */
	getManyBy(groupValue: any): T[] | undefined {
		const group = this.groups.get(groupValue);
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
				oldGroup.delete(oldEntity.id);
			}
		}

		if (group) {
			group.set(entity.id, entity);
		}
	}

	/**
	 * Initializes a group of entities
	 *
	 * @param {any} groupValue The value of the group
	 * @param {T[]} entities The entities
	 */
	initGroup(groupValue: any, entities: T[]) {
		if (this.groups.has(groupValue)) {
			return;
		}
		this.groups.set(groupValue, new Map());
		this.addToGroup(groupValue, entities);
	}

	addToGroup(groupValue: any, entities: T | T[]) {
		const group = this.groups.get(groupValue);
		if (!group) {
			throw this.errUninitializedGroup(groupValue);
		}

		entities = ensureArray(entities);
		for (const entity of entities) {
			group.set(entity.id, entity);
		}
	}

	private getGroupForEntity(entity: T): Map<Id, T> | undefined {
		const groupValue = this.requireIndexValue(entity);
		return this.groups.get(groupValue);
	}

	private errUninitializedGroup(groupValue: any) {
		throw new Error(`Cannot add entities to uninitialized index group ${this.field}=${groupValue}`);
	}
}

class SequentialGroup<T extends CSEntity> {
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

export class GroupSequentialIndex<T extends CSEntity> extends BaseIndex<T> {
	readonly type = IndexType.GroupSequential;
	private readonly groups = new Map<any, SequentialGroup<T>>();
	private readonly seqField: keyof T;

	constructor(groupField: keyof T, seqField: keyof T) {
		super(groupField);
		this.seqField = seqField;
	}

	set(entity: T, oldEntity?: T) {
		const groupValue = this.requireIndexValue(entity);
		const group = this.groups.get(groupValue);
		if (group) {
			const seqValue = this.requireSeqValue(entity);
			group.set(seqValue, entity);
		}
	}

	initGroup(groupValue: any, entities: T[]) {
		if (this.groups.has(groupValue)) {
			return;
		}
		this.groups.set(groupValue, new SequentialGroup<T>());
		this.addToGroup(groupValue, entities);
	}

	addToGroup(groupValue: any, entities: T | T[]) {
		const group = this.groups.get(groupValue);
		if (!group) {
			throw this.errUninitializedGroup(groupValue);
		}

		entities = ensureArray(entities);
		for (const entity of entities) {
			const seqValue = (entity as any)[this.seqField];
			if (typeof seqValue !== "number") {
				throw this.errSeqNonNumeric(entity.id, seqValue);
			}
			group.set(seqValue, entity);
		}
	}

	getGroupSlice(groupValue: any, seqStart: number, seqEnd: number): SequentialSlice<T> | undefined {
		const group = this.groups.get(groupValue);
		if (group) {
			const dataSlice = group.dataSlice(seqStart, seqEnd);
			return new SequentialSlice(dataSlice, this.seqField, seqStart, seqEnd, group.maxSeq);
		} else {
			return;
		}
	}

	getGroupTail(groupValue: any, limit: number): SequentialSlice<T> | undefined {
		const group = this.groups.get(groupValue);
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
			throw this.errSeqNonNumeric(entity.id, seqValue);
		}
		return seqValue;
	}

	private errUninitializedGroup(groupValue: any) {
		throw new Error(`Cannot add entities to uninitialized index group ${this.field}=${groupValue}`);
	}

	private errSeqNonNumeric(id: Id, seqValue: any): Error {
		return new Error(
			`Cannot add entity with id=${id} to group sequential index ${
				this.field
			}: value for sequence field ${
				this.seqField
			} should be a number, but is ${seqValue}:${typeof seqValue}`
		);
	}
}

export type Index<T extends CSEntity> = UniqueIndex<T> | GroupIndex<T> | GroupSequentialIndex<T>;
