"use strict";

import { CSEntity } from "../../shared/api.protocol";
import { Id } from "../entityManager";
import { BaseCache, UniqueFetchFn } from "./baseCache";
import { IndexParams, IndexType, makeIndex, UniqueIndex } from "./index";

/**
 * <p>Cache for entities. All entities are indexed by Id. Indexes for additional fields can be
 * declared, allowing to efficiently retrieve entities or groups of entities by their values.</p>
 *
 * <p>The following types of indexes are supported:</p>
 *
 * <ul>
 * 		<li>#UniqueIndex: For unique fields such as person's SSN; allows to retrieve entities via
 * 		{#getGroup}</li>
 *
 * 		<li>#GroupIndex: For grouping fields such as user's teamId; allows to retrieve groups of
 * 		entities via {#getGroup}</li>
 *
 * 		<li>#GroupSequentialIndex: For grouping fields accompanied by a sequence field which defines
 * 		the order within the group such as post's streamId/seqNum; allows to retrieve slices of groups
 * 		via #getGroupSlice and #getGroupTail</li>
 * </ul>
 */
export class EntityCache<T extends CSEntity> extends BaseCache<T> {
	/**
	 * Create a cache
	 *
	 * @param idxFields Indexed fields
	 * @param fetchById Function to fetch an entity by Id
	 */
	constructor(idxFields: IndexParams<T>[], fetchById: UniqueFetchFn<T>) {
		super(idxFields);
		this.indexes.set(
			"id",
			makeIndex({
				fields: ["id"],
				type: IndexType.Unique,
				fetchFn: fetchById
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
	async getById(id: Id): Promise<T> {
		const entity = await this.get([["id", id]]);
		if (!entity) {
			throw new Error(`Could not find entity with ID ${id}`);
		}
		return entity;
	}

	getAll(): T[] {
		const index = this.indexes.get("id") as UniqueIndex<T>;
		return index.getAll();
	}
}
