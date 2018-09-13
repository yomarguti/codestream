"use strict";

import { CSEntity } from "../shared/api.protocol";
import { Index, IndexType, makeIndex, UniqueIndex } from "./index";
import { Id } from "./managers";
import { SequentialSlice } from "./sequentialSlice";

/**
 * <p>Cache for entities. All entities are indexed by Id. Indexes for additional fields can be
 * declared, allowing to efficiently retrieve entities or groups of entities by their values.</p>
 *
 * <p>The following types of indexes are supported:</p>
 *
 * <ul>
 * 		<li>#UniqueIndex: For unique fields such as person's SSN; allows to retrieve entities via
 * 		{#getManyBy}</li>
 *
 * 		<li>#GroupIndex: For grouping fields such as user's teamId; allows to retrieve groups of
 * 		entities via {#getManyBy}</li>
 *
 * 		<li>#GroupSequentialIndex: For grouping fields accompanied by a sequence field which defines
 * 		the order within the group such as post's streamId/seqNum; allows to retrieve slices of groups
 * 		via #getGroupSlice and #getGroupTail</li>
 * </ul>
 */
export class Cache<T extends CSEntity> {
	private readonly indexes: Map<keyof T, Index<T>>;

	/**
	 * Create a cache
	 *
	 * @param indexes Map of indexes by field
	 */
	constructor(indexes: Map<keyof T, Index<T>>) {
		this.indexes = indexes;
		this.indexes.set(
			"id",
			makeIndex({
				field: "id",
				type: IndexType.Unique
			})
		);
	}

	/**
	 * Get an entity by Id
	 *
	 * @param id Id
	 *
	 * @return Entity or `undefined`
	 */
	get(id: Id): T | undefined {
		const index = this.indexes.get("id") as UniqueIndex<T>;
		return index.get(id);
	}

	/**
	 * Get an entity by field. Requires an unique index.
	 *
	 * @param field The field
	 * @param value The field value
	 *
	 * @return Entity or `undefined`
	 */
	getBy(field: keyof T, value: any): T | undefined {
		const index = this.indexes.get(field);
		if (!index || index.type != IndexType.Unique) {
			throw new Error(`No unique index declared for field ${field}`);
		}
		return index.get(value);
	}

	/**
	 * Get a group of entities by field. Requires a group index.
	 *
	 * @param field The field
	 * @param value The field value
	 *
	 * @return Array of entities or `undefined` if group is not initialized
	 */
	getManyBy(field: keyof T, value: any): T[] | undefined {
		const index = this.indexes.get(field);
		if (!index || index.type != IndexType.Group) {
			throw new Error(`No group index declared for field ${field}`);
		}
		return index.getManyBy(value);
	}

	/**
	 * Get a slice of a group of entities. Returned array will contain entities in the specified
	 * group with sequences from seqStart to seqEnd-1. Requires a group-sequential index.
	 *
	 * @param groupField The group field
	 * @param groupValue The group field value
	 * @param seqStart The starting sequence
	 * @param seqEnd The ending sequence
	 *
	 * @return {SequentialSlice} of entities or `undefined` if group is not initialized
	 */
	getGroupSlice(
		groupField: keyof T,
		groupValue: any,
		seqStart: number,
		seqEnd: number
	): SequentialSlice<T> | undefined {
		const index = this.indexes.get(groupField);
		if (!index || index.type !== IndexType.GroupSequential) {
			throw new Error(`No group-sequential index declared for field ${groupField}`);
		}

		return index.getGroupSlice(groupValue, seqStart, seqEnd);
	}

	/**
	 * Get the tail (trailing slice) of a group of entities. Returned array will contain `n`
	 * elements as specified via #limit parameter, unless the whole group contain less than `n`
	 * entities. Requires a group-sequential index.
	 *
	 * @param groupField The group field
	 * @param groupValue The group field value
	 * @param limit Maximum number of entities to be included in the result
	 *
	 * @return {SequentialSlice} of entities or `undefined` if group is not initialized
	 */
	getGroupTail(
		groupField: keyof T,
		groupValue: any,
		limit: number
	): SequentialSlice<T> | undefined {
		const index = this.indexes.get(groupField);
		if (!index || index.type !== IndexType.GroupSequential) {
			throw new Error(`No group-sequential index declared for field ${groupField}`);
		}

		return index.getGroupTail(groupValue, limit);
	}

	/**
	 * Add or update an entity. All initialized indexes are updated. In order to dissociate an
	 * updated entity from its old indexed values, #oldEntity must be specified.
	 *
	 * @param entity {T} The entity
	 * @param oldEntity {?T} The old version of the entity
	 */
	set(entity: T, oldEntity?: T) {
		for (const [field, index] of this.indexes) {
			const value = (entity as any)[field];
			if (value != null) {
				index.set(entity, oldEntity);
			}
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
	initGroup(groupField: keyof T, groupValue: any, entities: T[]) {
		const index = this.requireIndex(groupField);
		if (index.type !== IndexType.Group && index.type !== IndexType.GroupSequential) {
			throw new Error(
				`Cannot initialize group ${groupField}=${groupValue} because it doesn't have an associated group or group-sequential index`
			);
		}

		for (const entity of entities) {
			this.set(entity);
		}
		index.initGroup(groupValue, entities);
	}

	private requireIndex(field: keyof T): Index<T> {
		const index = this.indexes.get(field);
		if (index == null) {
			throw new Error(`No index declared for field ${field}`);
		}
		return index;
	}
}
