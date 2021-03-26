"use strict";
import semver from "semver";
import { gate } from "../../system/decorators/gate";
import {
	DocumentNode,
	FieldNode,
	OperationDefinitionNode,
	print,
	SelectionNode,
	SelectionSetNode
} from "graphql";
import { Logger } from "../../logger";

interface Leaf {
	value: {
		key: string;
		exclusions?: string[];
	};
	next?: Leaf;
}

interface GraphQlQueryModifier {
	/**
	 * Selector that decides of the current version meets the stated requirement
	 *
	 * @memberof GraphQlQueryModifier
	 */
	selector: (currentVersion: string) => boolean;
	/**
	 * note: this is a linked list
	 *
	 * @type {{
	 * 		head: Leaf;
	 * 	}}
	 * @memberof GraphQlQueryModifier
	 */
	query: {
		head: Leaf;
	};
}

export class GraphqlQueryBuilder {
	/**
	 * GraphQL data store
	 *
	 * @type {*}
	 * @memberof GraphQlCache
	 */
	private store: any = {
		"0.0.0": {
			emptyQueryName: ""
		}
	};
	/**
	 *
	 */
	constructor(private providerId: string) {}

	configuration: { [id: string]: GraphQlQueryModifier[] } = {
		// for the GetPullRequest query, if the current version if <= 13.6.0 run this...
		GetPullRequest: [
			{
				selector: (currentVersion: string) => semver.lt(currentVersion, "13.6.0"),
				query: {
					head: {
						value: {
							key: "GetPullRequest"
						},
						next: {
							value: {
								key: "project"
							},
							next: {
								value: {
									key: "mergeRequest",
									exclusions: ["commitCount", "userDiscussionsCount"]
								},
								next: {
									value: {
										key: "userPermissions",
										exclusions: ["canMerge"]
									}
								}
							}
						}
					}
				}
			}
		]
	};

	/**
	 * Builds and returns the GraphQL query for a certain document and key
	 *
	 * @param {string} version in the format of X.Y.Z
	 * @param {DocumentNode} document the imported document
	 * @param {"GetPullRequest"} queryKey add additional queries here
	 * @return {*}  {(Promise<string | undefined>)}
	 * @memberof GraphqlQueryStore
	 */
	@gate()
	async build(
		version: string,
		document: DocumentNode,
		queryKey: "GetPullRequest"
	): Promise<string> {
		try {
			const versionedQuery = this.store[version];
			if (versionedQuery) {
				const keyedQuery = versionedQuery[queryKey];
				if (keyedQuery) {
					Logger.debug(`GraphqlQueryStore.build ${this.providerId} version=${version} cache hit`);
					return keyedQuery;
				}
			}
			let queryAsString = "";

			const configurations = this.configuration[queryKey];
			if (!version || version === "0.0.0" || !configurations || !configurations.length) {
				queryAsString = print(document);
				this.store[version] = {};
				this.store[version][queryKey] = queryAsString;
				Logger.debug(`GraphqlQueryStore.build ${this.providerId} version=${version} no config`);
				return queryAsString;
			}

			// since this is an object that is imported, we don't
			// want to modifiy it for all uses
			const documentClone = JSON.parse(JSON.stringify(document)) as DocumentNode;
			if (configurations?.length) {
				for (const config of configurations) {
					if (!config.selector(version)) continue;

					Logger.debug(
						`GraphqlQueryStore.build ${this.providerId} version=${version} found config`
					);
					const debugging = [];
					const headData = config.query.head;
					let head = config.query.head.next;

					let lastSelectionSet: SelectionSetNode | undefined = (documentClone.definitions.find(
						(_: any) => _.name && _.name.value === headData!.value.key
					) as OperationDefinitionNode)?.selectionSet;

					while (head != null) {
						debugging.push(head.value);
						const currentSelectionSet:
							| SelectionSetNode
							| undefined = (lastSelectionSet?.selections?.find((_: SelectionNode) => {
							// OMG Typescript, UGH
							const node = _ as FieldNode;
							return node.name && node.name.value === head!.value.key;
						}) as FieldNode)?.selectionSet;

						if (currentSelectionSet && head.value.exclusions) {
							for (const exclusionName of head.value.exclusions) {
								const exclusion = currentSelectionSet.selections?.find((_: SelectionNode) => {
									// OMG Typescript, UGH
									const node = _ as FieldNode;
									return node.name.value === exclusionName;
								}) as FieldNode;
								if (exclusion) {
									// NameNode is readonly in TS, but we're modifying it anyway
									// comment it out with a '#'
									(exclusion.name as any).value = `#${exclusionName}`;
									Logger.log(
										`GraphqlQueryStore.build ${
											this.providerId
										} version=${version} excluding=${debugging
											.map(_ => _.key)
											.join(".")}.${exclusionName}`
									);
								}
							}
						}
						lastSelectionSet = currentSelectionSet;
						head = head.next as Leaf;
					}
					Logger.log(
						`GraphqlQueryStore.build ${this.providerId} version=${version} saving query for ${queryKey}`
					);
				}
			} else {
				Logger.debug(
					`GraphqlQueryStore.build ${this.providerId} version=${version} saving default query for ${queryKey}`
				);
			}
			queryAsString = print(documentClone);
			this.store[version] = {};
			this.store[version][queryKey] = queryAsString;
			return queryAsString;
		} catch (ex) {
			Logger.warn(`GraphqlQueryStore.build ${this.providerId} error`, {
				error: ex,
				version: version,
				queryKey: queryKey
			});
			return print(document);
		}
	}
}
