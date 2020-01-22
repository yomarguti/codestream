"use strict";
import { ParsedDiff, structuredPatch } from "diff";
import * as eol from "eol";
import * as path from "path";
import { TextDocumentIdentifier } from "vscode-languageserver";
import { URI } from "vscode-uri";
import { MarkerLocation, MarkerLocationsById } from "../api/extensions";
import { getCache } from "../cache";
import { Container, SessionContainer } from "../container";
import { GitRepository } from "../git/models/repository";
import { Logger } from "../logger";
import { calculateLocation, calculateLocations } from "../markerLocation/calculator";
import { MarkerNotLocatedReason, ReportingMessageType } from "../protocol/agent.protocol";
import {
	CSLocationArray,
	CSMarker,
	CSMarkerLocation,
	CSMarkerLocations,
	CSReferenceLocation
} from "../protocol/api.protocol";
import { xfs } from "../xfs";
import { ManagerBase } from "./baseManager";
import { IndexParams, IndexType } from "./cache";
import { getValues, KeyValue } from "./cache/baseCache";
import { Id } from "./entityManager";
import { BacktrackedLocation } from "./markersManager";

export interface Markerish {
	id: string;
	referenceLocations: CSReferenceLocation[];
}

export interface MissingLocationsById {
	[id: string]: {
		reason: MarkerNotLocatedReason;
		details?: string;
	};
}

interface UncommittedLocation {
	fileContents: string;
	location: CSMarkerLocation;
}

interface UncommittedLocationsById {
	[id: string]: UncommittedLocation;
}

interface GetLocationsResult {
	locations: MarkerLocationsById;
	missingLocations: MissingLocationsById;
}

function newGetLocationsResult(): GetLocationsResult {
	return {
		locations: {},
		missingLocations: {}
	};
}

function stripEof(x: any) {
	const lf = typeof x === "string" ? "\n" : "\n".charCodeAt(0);
	const cr = typeof x === "string" ? "\r" : "\r".charCodeAt(0);

	if (x[x.length - 1] === lf) {
		x = x.slice(0, x.length - 1);
	}

	if (x[x.length - 1] === cr) {
		x = x.slice(0, x.length - 1);
	}

	return x;
}

function compareReferenceLocations(a: CSReferenceLocation, b: CSReferenceLocation): number {
	const aIsCanonical = Number(!!a.flags.canonical);
	const bIsCanonical = Number(!!b.flags.canonical);

	return bIsCanonical - aIsCanonical;
}

export class MarkerLocationManager extends ManagerBase<CSMarkerLocations> {
	protected forceFetchToResolveOnCacheMiss = true;

	getIndexedFields(): IndexParams<CSMarkerLocations>[] {
		return [
			{
				fields: ["streamId", "commitHash"],
				type: IndexType.Unique,
				fetchFn: this.fetch.bind(this)
			}
		];
	}

	async cacheSet(
		entity: CSMarkerLocations,
		oldEntity?: CSMarkerLocations
	): Promise<CSMarkerLocations | undefined> {
		if (oldEntity) {
			entity.locations = {
				...oldEntity.locations,
				...entity.locations
			};
		}
		return super.cacheSet(entity, oldEntity);
	}

	protected async fetch(criteria: KeyValue<CSMarkerLocations>[]): Promise<CSMarkerLocations> {
		const [streamId, commitHash] = getValues(criteria);
		const response = await this.session.api.fetchMarkerLocations({
			streamId,
			commitHash
		});
		return response.markerLocations;
	}

	protected fetchCriteria(obj: CSMarkerLocations): KeyValue<CSMarkerLocations>[] {
		return [
			["streamId", obj.streamId],
			["commitHash", obj.commitHash]
		];
	}

	async getCurrentLocations(
		documentUri: string,
		fileStreamId?: string,
		markers?: CSMarker[]
	): Promise<GetLocationsResult> {
		const { documents } = Container.instance();
		const { git } = SessionContainer.instance();
		const result = newGetLocationsResult();

		const filePath = URI.parse(documentUri).fsPath;
		let repoRoot;
		try {
			repoRoot = await git.getRepoRoot(filePath);
		} catch {}
		if (!repoRoot) {
			Logger.log(`MARKERS: no repo root for ${filePath}`);
			return result;
		}

		if (fileStreamId === undefined) {
			const stream = await SessionContainer.instance().files.getByPath(filePath);
			if (!stream) {
				Logger.log(`MARKERS: no stream for for ${filePath}`);
				return result;
			}
			fileStreamId = stream!.id;
		}
		if (markers === undefined) {
			markers = await SessionContainer.instance().markers.getByStreamId(fileStreamId, true);
		}

		const currentCommitHash = await git.getFileCurrentRevision(filePath);
		const currentCommitLocations = await this.getCommitLocations(
			filePath,
			currentCommitHash,
			fileStreamId,
			markers
		);
		Object.assign(result.missingLocations, currentCommitLocations.missingLocations);

		Logger.log(`MARKERS: classifying locations`);
		Logger.log(`MARKERS: found ${markers.length} markers - retrieving current locations`);

		const {
			committedLocations,
			uncommittedLocations
		} = await MarkerLocationManager.classifyLocations(
			repoRoot,
			markers,
			currentCommitLocations.locations
		);

		const doc = documents.get(documentUri);
		Logger.log(`MARKERS: retrieving current text from document manager`);
		let currentBufferText = doc && doc.getText();
		if (currentBufferText == null) {
			Logger.log(`MARKERS: current text not found in document manager - reading from disk`);
			currentBufferText = await xfs.readText(filePath);
		}
		if (!currentBufferText) {
			Logger.log(
				`MARKERS: Could not retrieve contents for ${filePath} from document manager or file system. File does not exist in current branch.`
			);
			return result;
		}

		if (Object.keys(committedLocations).length) {
			Logger.log(`MARKERS: calculating current location for committed locations`);
			const currentCommitText = await git.getFileContentForRevision(filePath, currentCommitHash!);
			if (currentCommitText === undefined) {
				throw new Error(`Could not retrieve contents for ${filePath}@${currentCommitHash}`);
			}
			const diff = structuredPatch(
				filePath,
				filePath,
				stripEof(eol.auto(currentCommitText)),
				stripEof(eol.auto(currentBufferText)),
				"",
				""
			);
			const calculatedLocations = await calculateLocations(committedLocations, diff);
			for (const id in committedLocations) {
				const commLoc = committedLocations[id];
				const currLoc = calculatedLocations[id];
				Logger.log(
					`MARKERS: ${id} [${commLoc.lineStart}, ${commLoc.colStart}, ${commLoc.lineEnd}, ${commLoc.colEnd}] => [${currLoc.lineStart}, ${currLoc.colStart}, ${currLoc.lineEnd}, ${currLoc.colEnd}]`
				);
				if (currLoc.meta && currLoc.meta.contentChanged) {
					// Logger.log("IT'S A TRAP!!!!!!!!!!!");
				}
			}
			Object.assign(result.locations, calculatedLocations);
		}

		if (Object.keys(uncommittedLocations).length) {
			Logger.log(`MARKERS: calculating current location for uncommitted locations`);
			for (const id in uncommittedLocations) {
				const uncommittedLocation = uncommittedLocations[id];
				const uncommittedBufferText = uncommittedLocation.fileContents;
				const diff = structuredPatch(
					filePath,
					filePath,
					stripEof(eol.auto(uncommittedBufferText)),
					stripEof(eol.auto(currentBufferText)),
					"",
					""
				);
				const currLoc = (await calculateLocation(uncommittedLocation.location, diff)) || {};
				result.locations[id] = currLoc;

				const uncommLoc = uncommittedLocation.location || {};

				Logger.log(
					`MARKERS: ${id} [${uncommLoc.lineStart}, ${uncommLoc.colStart}, ${uncommLoc.lineEnd}, ${uncommLoc.colEnd}] => [${currLoc.lineStart}, ${currLoc.colStart}, ${currLoc.lineEnd}, ${currLoc.colEnd}]`
				);
			}
		}

		for (const marker of markers) {
			const location = result.locations[marker.id];
			if (
				marker.referenceLocations &&
				marker.referenceLocations.length &&
				location !== undefined &&
				location.lineStart === location.lineEnd &&
				location.colStart === location.colEnd
			) {
				const [
					lineStartWhenCreated,
					colStartWhenCreated,
					lineEndWhenCreated,
					colEndWhenCreated
				] = marker.referenceLocations[0].location;
				if (location.meta === undefined) location.meta = {};
				if (
					lineStartWhenCreated !== lineEndWhenCreated ||
					colStartWhenCreated !== colEndWhenCreated
				) {
					location.meta.entirelyDeleted = true;
				}
			}
		}

		return result;
	}

	private static async classifyLocations(
		repoPath: string,
		markers: CSMarker[],
		committedLocations: MarkerLocationsById
	): Promise<{
		committedLocations: MarkerLocationsById;
		uncommittedLocations: UncommittedLocationsById;
	}> {
		const result = {
			committedLocations: {} as MarkerLocationsById,
			uncommittedLocations: {} as UncommittedLocationsById
		};
		Logger.log(`MARKERS: retrieving uncommitted locations from local cache`);
		const cache = await getCache(repoPath);
		const cachedUncommittedLocations = cache.getCollection("uncommittedLocations");
		for (const { id } of markers) {
			const committedLocation = committedLocations[id];
			const uncommittedLocation = cachedUncommittedLocations.get(id);
			if (uncommittedLocation) {
				Logger.log(`MARKERS: ${id}: uncommitted`);
				result.uncommittedLocations[id] = uncommittedLocation;
			} else if (committedLocation) {
				Logger.log(`MARKERS: ${id}: committed`);
				result.committedLocations[id] = committedLocation;
			}
		}

		return result;
	}

	async backtrackLocation(
		documentId: TextDocumentIdentifier,
		text: string,
		location: CSMarkerLocation,
		revision: string
	): Promise<CSMarkerLocation> {
		const { git } = SessionContainer.instance();
		const documentUri = documentId.uri;
		const filePath = URI.parse(documentUri).fsPath;

		if (!revision) {
			// TODO marcelo - must signal
			return location;
			// return deletedLocation(location);
		}

		const currentCommitText = await git.getFileContentForRevision(filePath, revision);
		if (currentCommitText === undefined) {
			throw new Error(`Could not retrieve contents for ${filePath}@${revision}`);
		}

		// Maybe in this case the IDE should inform the buffer contents to ensure we have the exact same
		// buffer text the user is seeing
		const diff = structuredPatch(
			filePath,
			filePath,
			stripEof(eol.auto(text)),
			stripEof(eol.auto(currentCommitText)),
			"",
			""
		);
		return calculateLocation(location, diff);
	}

	async getCommitLocations(
		filePath: string,
		commitHash?: string,
		fileStreamId?: string,
		markers?: CSMarker[]
	): Promise<GetLocationsResult> {
		if (commitHash === undefined) return newGetLocationsResult();

		Logger.log(`MARKERS: getting locations for ${filePath}@${commitHash}`);

		if (fileStreamId === undefined) {
			const stream = await SessionContainer.instance().files.getByPath(filePath);
			if (!stream) {
				Logger.log(`MARKERS: cannot find streamId for ${filePath}`);
				return newGetLocationsResult();
			}

			fileStreamId = stream.id;
		}

		if (markers === undefined) {
			markers = await SessionContainer.instance().markers.getByStreamId(fileStreamId, true);
		}
		Logger.log(`MARKERS: found ${markers.length} markers for stream ${fileStreamId}`);

		const currentCommitLocations = await this.getMarkerLocationsById(fileStreamId, commitHash);
		const missingLocations: MissingLocationsById = {};

		const missingMarkers = markers.filter(m => !currentCommitLocations[m.id]);
		if (missingMarkers.length === 0) {
			Logger.log(`MARKERS: no missing locations`);
		} else {
			Logger.log(`MARKERS: missing locations detected - will calculate`);
		}

		const { git, session } = SessionContainer.instance();
		const diffsByCommitHash: Map<string, ParsedDiff> = new Map();
		const locationsByCommitHash: Map<string, MarkerLocationsById> = new Map();
		let fetchIfCommitNotFound = true;
		for (const missingMarker of missingMarkers) {
			missingMarker.referenceLocations.sort(compareReferenceLocations);
			let canCalculate = false;
			for (const referenceLocation of missingMarker.referenceLocations) {
				if (!diffsByCommitHash.has(referenceLocation.commitHash)) {
					const diff = await git.getDiffBetweenCommits(
						referenceLocation.commitHash,
						commitHash,
						filePath,
						fetchIfCommitNotFound
					);
					fetchIfCommitNotFound = false;
					if (diff) {
						diffsByCommitHash.set(referenceLocation.commitHash, diff);
						if (!locationsByCommitHash.has(referenceLocation.commitHash)) {
							locationsByCommitHash.set(referenceLocation.commitHash, {});
						}
						const locationsById = locationsByCommitHash.get(referenceLocation.commitHash)!!;
						locationsById[missingMarker.id] = MarkerLocation.fromArray(
							referenceLocation.location,
							missingMarker.id
						);
						canCalculate = true;
						break;
					}
				}
			}

			if (!canCalculate) {
				const details = `Could not find any of the following reference commit hashes for marker ${
					missingMarker.id
				} in local git repository: ${missingMarker.referenceLocations
					.map(rl => rl.commitHash)
					.join(", ")}`;
				missingLocations[missingMarker.id] = {
					reason: MarkerNotLocatedReason.MISSING_ORIGINAL_COMMIT,
					details
				};
				Logger.warn(details);
			}
		}

		for (const [referenceCommitHash, diff] of diffsByCommitHash.entries()) {
			Logger.log(
				`MARKERS: calculating locations based on diff from ${referenceCommitHash} to ${commitHash}`
			);
			const locationsToCalculate = locationsByCommitHash.get(referenceCommitHash)!!;
			const calculatedLocations = await calculateLocations(locationsToCalculate, diff);
			Object.assign(currentCommitLocations, calculatedLocations);

			for (const id in calculatedLocations) {
				const origLoc = locationsToCalculate[id] || {};
				const currLoc = calculatedLocations[id] || {};
				Logger.log(
					`MARKERS: ${id} [${origLoc.lineStart}, ${origLoc.colStart}, ${origLoc.lineEnd}, ${origLoc.colEnd}] => [${currLoc.lineStart}, ${currLoc.colStart}, ${currLoc.lineEnd}, ${currLoc.colEnd}]`
				);
			}

			Logger.log(
				`MARKERS: saving ${
					Object.keys(calculatedLocations).length
				} calculated locations to API server`
			);
			await session.api.createMarkerLocation({
				streamId: fileStreamId,
				commitHash,
				locations: MarkerLocation.toArraysById(calculatedLocations)
			});
		}

		return {
			locations: currentCommitLocations,
			missingLocations
		};
	}

	async saveUncommittedLocation(
		filePath: string,
		fileContents: string,
		location: CSMarkerLocation
	) {
		Logger.log(`MARKERS: saving uncommitted marker location ${location.id} to local cache`);
		const { git } = SessionContainer.instance();

		let repoRoot;
		try {
			repoRoot = await git.getRepoRoot(filePath);
		} catch {
			throw new Error(`Unable to find Git`);
		}
		if (!repoRoot) {
			throw new Error(`Could not find repo root for ${filePath}`);
		}

		const cache = await getCache(repoRoot);
		const uncommittedLocations = cache.getCollection("uncommittedLocations");
		uncommittedLocations.set(location.id, {
			fileContents,
			location
		} as UncommittedLocation);
		Logger.log(`MARKERS: flushing local cache`);
		await cache.flush();
		Logger.log(`MARKERS: local cache flushed`);
	}

	async flushUncommittedLocations(repo: GitRepository) {
		Logger.log(`MARKERS: flushing uncommitted locations`);
		const { git, files, markers, session } = SessionContainer.instance();
		const cache = await getCache(repo.path);
		const uncommittedLocations = cache.getCollection("uncommittedLocations");

		for (const id of uncommittedLocations.keys()) {
			Logger.log(`MARKERS: checking uncommitted marker ${id}`);
			const marker = await markers.getById(id);
			const fileStream = await files.getById(marker!.fileStreamId);
			const uncommittedLocation = uncommittedLocations.get(id) as UncommittedLocation;
			const originalContents = uncommittedLocation.fileContents;
			const relPath = fileStream.file;
			const absPath = path.join(repo.path, relPath);
			const commitHash = await git.getFileCurrentRevision(absPath);
			if (!commitHash) {
				Logger.log(`MARKERS: file ${relPath} is not committed yet - skipping`);
				continue;
			}
			const commitContents = await git.getFileContentForRevision(absPath, commitHash);
			if (!commitContents) {
				Logger.log(`MARKERS: file ${relPath} has no contents on revision ${commitHash} - skipping`);
				continue;
			}
			const diff = structuredPatch(
				relPath,
				relPath,
				stripEof(eol.auto(originalContents)),
				stripEof(eol.auto(commitContents)),
				"",
				""
			);
			const location = await calculateLocation(uncommittedLocation.location, diff);
			if (location.meta && location.meta.entirelyDeleted) {
				Logger.log(`MARKERS: location is not present on commit ${commitHash} - skipping`);
				continue;
			}
			const locationArraysById = {} as {
				[id: string]: CSLocationArray;
			};
			locationArraysById[id] = MarkerLocation.toArray(location);
			Logger.log(
				`MARKERS: committed ${id}@${commitHash} => [${location.lineStart}, ${location.colStart}, ${location.lineEnd}, ${location.colEnd}] - saving to API server`
			);
			await session.api.createMarkerLocation({
				streamId: fileStream.id,
				commitHash,
				locations: locationArraysById
			});
			Logger.log(`MARKERS: adding canonical reference location for ${id}@${commitHash}`);
			await session.api.addReferenceLocation({
				markerId: id,
				commitHash,
				location: MarkerLocation.toArray(location),
				flags: {
					canonical: true,
					committedAfterCreation: true
				}
			});
			uncommittedLocations.delete(id);
			Logger.log(`MARKERS: flushing local cache`);
			await cache.flush();
			Logger.log(`MARKERS: local cache flushed`);
		}
	}

	async getMarkerLocations(
		streamId: Id,
		commitHash: string
	): Promise<CSMarkerLocations | undefined> {
		return this.cache.get([
			["streamId", streamId],
			["commitHash", commitHash]
		]);
	}

	async getMarkerLocationsById(streamId: Id, commitHash: string): Promise<MarkerLocationsById> {
		const markerLocations = await this.getMarkerLocations(streamId, commitHash);
		return MarkerLocation.toLocationsById(markerLocations);
	}

	protected getEntityName(): string {
		return "MarkerLocation";
	}

	static async computeCurrentLocations(uri: URI, markersByCommit: Map<string, Markerish[]>) {
		const locations: MarkerLocationsById = Object.create(null);
		const orphans: MissingLocationsById = Object.create(null);

		if (markersByCommit.size === 0) {
			return { locations, orphans };
		}

		const { documents } = Container.instance();
		const { git } = SessionContainer.instance();

		const filePath = uri.fsPath;
		const currentFileRevision = await git.getFileCurrentRevision(uri);
		if (currentFileRevision === undefined) {
			Logger.warn(
				`computeCurrentLocations: Could not determine current revision for ${uri.fsPath}`
			);
			return { locations, orphans };
		}

		let fetchIfCommitNotFound = true;
		for (const [revision, markers] of markersByCommit.entries()) {
			const diff = await git.getDiffBetweenCommits(
				revision,
				currentFileRevision,
				filePath,
				fetchIfCommitNotFound
			);
			fetchIfCommitNotFound = false;
			if (!diff) {
				const details = `cannot obtain diff - skipping calculation from ${revision} to ${currentFileRevision}`;
				for (const marker of markers) {
					orphans[marker.id] = {
						reason: MarkerNotLocatedReason.MISSING_ORIGINAL_COMMIT,
						details
					};
				}

				continue;
			}

			const locationsToCalculate: MarkerLocationsById = Object.create(null);
			for (const marker of markers) {
				const location = marker.referenceLocations[0].location;
				locationsToCalculate[marker.id] = {
					id: marker.id,
					lineStart: location[0],
					colStart: location[1],
					lineEnd: location[2],
					colEnd: location[3]
				};
			}

			const calculatedLocations = await calculateLocations(locationsToCalculate, diff);
			for (const [id, location] of Object.entries(calculatedLocations)) {
				locations[id] = location;
			}
		}

		const locationsInCurrentCommit = {
			locations: locations,
			orphans: orphans
		};

		const currentCommitText = await git.getFileContentForRevision(uri, currentFileRevision);
		if (currentCommitText === undefined) {
			Logger.warn(`Could not retrieve contents for ${uri}@${currentFileRevision}`);
			return locationsInCurrentCommit;
		}

		const doc = documents.get(uri.toString(true));
		Logger.log(`MARKERS: retrieving current text from document manager`);
		let currentBufferText = doc && doc.getText();
		if (currentBufferText == null) {
			Logger.log(`MARKERS: current text not found in document manager - reading from disk`);
			currentBufferText = await xfs.readText(filePath);
		}
		if (!currentBufferText) {
			Logger.warn(
				`MARKERS: Could not retrieve contents for ${uri} from document manager or file system. File does not exist in current branch.`
			);
			return locationsInCurrentCommit;
		}

		const diff = structuredPatch(
			filePath,
			filePath,
			stripEof(eol.auto(currentCommitText)),
			stripEof(eol.auto(currentBufferText)),
			"",
			""
		);

		const locationsInCurrentBuffer = await calculateLocations(locations, diff);

		return {
			locations: locationsInCurrentBuffer,
			orphans: orphans
		};
	}

	static async saveUncommittedLocations(
		markers: CSMarker[],
		backtrackedLocations: (BacktrackedLocation | undefined)[]
	) {
		let index = 0;
		for await (const marker of markers) {
			try {
				const backtrackedLocation = backtrackedLocations[index];
				if (!backtrackedLocation) return;

				const atDocument = backtrackedLocation.atDocument;
				const atCurrentCommit = backtrackedLocation.atCurrentCommit;
				const filePath = backtrackedLocation.filePath;
				const fileContents = backtrackedLocation.fileContents;

				const meta = atCurrentCommit.meta;
				if (meta && (meta.startWasDeleted || meta.endWasDeleted)) {
					const uncommittedLocation = {
						...atDocument!,
						id: marker.id
					};

					await SessionContainer.instance().markerLocations.saveUncommittedLocation(
						filePath,
						fileContents,
						uncommittedLocation
					);
				}
			} catch (ex) {
				Logger.log(ex);
				Container.instance().errorReporter.reportMessage({
					type: ReportingMessageType.Error,
					message: ex.message,
					source: "agent",
					extra: ex.toString()
				});
			}
			index++;
		}
	}
}
