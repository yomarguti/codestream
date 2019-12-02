"use strict";
import * as path from "path";
import { Range, TextDocumentIdentifier } from "vscode-languageserver";
import { URI } from "vscode-uri";
import { Marker, MarkerLocation, Ranges } from "../api/extensions";
import { Container, SessionContainer } from "../container";
import { Logger } from "../logger";
import { calculateLocation } from "../markerLocation/calculator";
import {
	CodeBlockSource,
	CreateMarkerRequest,
	GetMarkerRequest,
	GetMarkerRequestType,
	GetMarkerResponse,
	MoveMarkerRequest,
	MoveMarkerRequestType,
	MoveMarkerResponse
} from "../protocol/agent.protocol";
import {
	CSMarker,
	CSMarkerLocation,
	CSReferenceLocation,
	CSStream,
	StreamType
} from "../protocol/api.protocol";
import { lsp, lspHandler } from "../system";
import { xfs } from "../xfs";
import { IndexParams, IndexType } from "./cache";
import { getValues, KeyValue } from "./cache/baseCache";
import { EntityManagerBase, Id } from "./entityManager";
import { MarkerLocationManager } from "./markerLocationManager";

@lsp
export class MarkersManager extends EntityManagerBase<CSMarker> {
	async getByStreamId(streamId: Id, visibleOnly?: boolean): Promise<CSMarker[]> {
		const markers = await this.cache.getGroup([["fileStreamId", streamId]]);
		this.polyfill(markers);
		return visibleOnly ? await this.filterMarkers(markers) : markers;
	}

	protected async fetchById(id: Id): Promise<CSMarker> {
		const response = await this.session.api.getMarker({ markerId: id });
		return response.marker;
	}

	getIndexedFields(): IndexParams<CSMarker>[] {
		return [
			{
				fields: ["fileStreamId"],
				type: IndexType.Group,
				fetchFn: this.fetchByStreamId.bind(this)
			}
		];
	}

	protected async fetchByStreamId(criteria: KeyValue<CSMarker>[]): Promise<CSMarker[]> {
		const [streamId] = getValues(criteria);
		const response = await this.session.api.fetchMarkers({ streamId: streamId });
		if (response.codemarks) {
			for (const codemark of response.codemarks) {
				SessionContainer.instance().codemarks.cacheSet(codemark);
			}
		}
		return response.markers;
	}

	private async filterMarkers(markers: CSMarker[]): Promise<CSMarker[]> {
		const includedMarkers = [];
		const { streams } = SessionContainer.instance();

		for (const marker of markers) {
			if (marker.supersededByMarkerId != null) {
				continue;
			}

			if (marker.deactivated) {
				continue;
			}

			if (!marker.postStreamId) {
				includedMarkers.push(marker);
				continue;
			}

			try {
				const stream = await streams.getByIdFromCache(marker.postStreamId);
				if (stream && this.canSeeMarkers(stream, this.session.userId)) {
					includedMarkers.push(marker);
				}
			} catch (ignore) {
				// TODO the APIs will fail when the user doesn't have access to the channel/dm
			}
		}

		return includedMarkers;
	}

	private canSeeMarkers(stream: CSStream, userId: string): boolean {
		if (stream.deactivated || stream.type === StreamType.File) return false;
		if (stream.type === StreamType.Channel) {
			if (stream.isArchived) return false;
			if (stream.memberIds === undefined) return true;
			if (!stream.memberIds.includes(userId)) return false;
		}
		return true;
	}

	@lspHandler(GetMarkerRequestType)
	protected async getMarker(request: GetMarkerRequest): Promise<GetMarkerResponse> {
		const marker = await this.getById(request.markerId);
		this.polyfill([marker]);
		return { marker: marker };
	}

	protected getEntityName(): string {
		return "Marker";
	}

	private polyfill(markers: CSMarker[]) {
		for (const marker of markers) {
			if (!marker.referenceLocations && marker.locationWhenCreated) {
				marker.referenceLocations = [
					{
						location: marker.locationWhenCreated,
						commitHash: marker.commitHashWhenCreated,
						flags: { canonical: true }
					}
				];
			}
		}
	}

	@lspHandler(MoveMarkerRequestType)
	protected async moveMarker(request: MoveMarkerRequest): Promise<MoveMarkerResponse> {
		const { code, documentId, range, source } = request;
		const descriptor = await MarkersManager.prepareMarkerCreationDescriptor(
			code,
			documentId,
			range,
			source
		);
		const response = await this.session.api.moveMarker({
			oldMarkerId: request.markerId,
			newMarker: descriptor.marker
		});

		MarkerLocationManager.saveUncommittedLocations(
			[response.marker],
			[descriptor.backtrackedLocation]
		);

		return response;
	}

	static async prepareMarkerCreationDescriptor(
		code: string,
		documentId: TextDocumentIdentifier,
		range: Range,
		source?: CodeBlockSource
	): Promise<MarkerCreationDescriptor> {
		const { documents } = Container.instance();
		const { git, files, scm } = SessionContainer.instance();
		let marker: CreateMarkerRequest | undefined;
		let backtrackedLocation: BacktrackedLocation | undefined;
		let fileCurrentCommit: string | undefined;
		let location: CSMarkerLocation | undefined;
		let locationAtCurrentCommit: CSMarkerLocation | undefined;
		let remotes: string[] | undefined;
		let remoteCodeUrl: { displayName: string; name: string; url: string } | undefined;

		Logger.log("prepareMarkerCreationDescriptor: creating post with associated range");
		// Ensure range end is >= start
		range = Ranges.ensureStartBeforeEnd(range);
		location = MarkerLocation.fromRange(range);
		let referenceLocations: CSReferenceLocation[] = [];

		const document = documents.get(documentId.uri);
		const filePath = URI.parse(documentId.uri).fsPath;
		const fileContents = document ? document.getText() : await xfs.readText(filePath);
		if (fileContents === undefined) {
			throw new Error(
				`prepareMarkerCreationDescriptor: Could not retrieve contents for ${documentId.uri} from document manager or file system. File does not exist in current branch.`
			);
		}

		if (source) {
			Logger.log("prepareMarkerCreationDescriptor: source information provided");
			if (source.revision) {
				fileCurrentCommit = source.revision;
				Logger.log(`prepareMarkerCreationDescriptor: source revision ${fileCurrentCommit}`);
				locationAtCurrentCommit = await SessionContainer.instance().markerLocations.backtrackLocation(
					documentId,
					fileContents,
					location,
					fileCurrentCommit
				);
				Logger.log(
					`prepareMarkerCreationDescriptor: location at current commit ${MarkerLocation.toArray(
						locationAtCurrentCommit
					)}`
				);

				const blameRevisionsPromises = git.getBlameRevisions(filePath, {
					ref: fileCurrentCommit,
					// it expects 0-based ranges
					startLine: locationAtCurrentCommit.lineStart - 1,
					endLine: locationAtCurrentCommit.lineEnd - 1,
					retryWithTrimmedEndOnFailure: true
				});
				const remoteDefaultBranchRevisionsPromises = git.getRemoteDefaultBranchHeadRevisions(
					source.repoPath,
					["upstream", "origin"]
				);
				const backtrackShas = [
					...(await blameRevisionsPromises).map(revision => revision.sha),
					...(await remoteDefaultBranchRevisionsPromises)
				].filter(function(sha, index, self) {
					return sha !== fileCurrentCommit && index === self.indexOf(sha);
				});
				Logger.log(
					`prepareMarkerCreationDescriptor: backtracking location to ${backtrackShas.length} revisions`
				);

				const promises = backtrackShas.map(async (sha, index) => {
					const diff = await git.getDiffBetweenCommits(fileCurrentCommit!, sha, filePath);
					const location = await calculateLocation(locationAtCurrentCommit!, diff!);
					const locationArray = MarkerLocation.toArray(location);
					Logger.log(`prepareMarkerCreationDescriptor: backtracked at ${sha} to ${locationArray}`);
					return {
						commitHash: sha,
						location: locationArray,
						flags: {
							backtracked: true
						}
					};
				});

				const meta = locationAtCurrentCommit.meta || {};
				const canonical = !meta.startWasDeleted || !meta.endWasDeleted;
				const referenceLocation = {
					commitHash: fileCurrentCommit,
					location: MarkerLocation.toArray(locationAtCurrentCommit),
					flags: {
						canonical,
						backtracked: !canonical
					}
				};
				const backtrackedLocations = await Promise.all(promises);
				referenceLocations = [referenceLocation, ...backtrackedLocations];
				Logger.log(
					`prepareMarkerCreationDescriptor: ${referenceLocations.length} reference locations calculated`
				);
			} else {
				Logger.log(`prepareMarkerCreationDescriptor: no source revision - file has no commits`);
				fileCurrentCommit = (await git.getRepoHeadRevision(source.repoPath))!;
				referenceLocations = [
					{
						commitHash: fileCurrentCommit,
						location: MarkerLocation.toArray(MarkerLocation.empty()),
						flags: {
							unversionedFile: true
						}
					}
				];
			}

			backtrackedLocation = {
				atDocument: location,
				atCurrentCommit: locationAtCurrentCommit || MarkerLocation.empty(),
				filePath: filePath,
				fileContents: fileContents
			};

			if (source.remotes && source.remotes.length > 0) {
				remotes = source.remotes.map(r => r.url);
			}
			Logger.log(`prepareMarkerCreationDescriptor: no source revision - file has no commits`);
		}

		marker = {
			code,
			commitHash: fileCurrentCommit,
			referenceLocations,
			branchWhenCreated: (source && source.branch) || undefined,
			remotes: remotes
		};

		if (source && source.file) {
			Logger.log(`prepareMarkerCreationDescriptor: identifying stream for file ${source.file}`);
			const fullPath = path.join(source.repoPath, source.file);
			const stream = await files.getByPath(fullPath);
			if (stream && stream.id) {
				Logger.log(`prepareMarkerCreationDescriptor: stream id=${stream.id}`);
				marker.fileStreamId = stream.id;
			} else {
				Logger.log(`prepareMarkerCreationDescriptor: no stream id found`);
				marker.file = source.file;
				const repo = await git.getRepositoryByFilePath(fullPath);
				if (repo && repo.id) {
					Logger.log(`prepareMarkerCreationDescriptor: repo id=${repo.id}`);
					marker.repoId = repo.id;
				} else {
					marker.knownCommitHashes = await MarkersManager.getKnownCommitHashes(source.repoPath);
					Logger.log(
						`prepareMarkerCreationDescriptor: known commit hashes = ${marker.knownCommitHashes.join(
							", "
						)}`
					);
				}
			}
		} else {
			Logger.log(`prepareMarkerCreationDescriptor: marker has no source file`);
		}

		try {
			Logger.log(`prepareMarkerCreationDescriptor: retrieving range information`);
			const scmResponse = await scm.getRangeInfo({
				uri: documentId.uri,
				range: range,
				contents: code,
				skipBlame: true
			});

			if (remotes !== undefined && scmResponse.scm !== undefined && scmResponse.scm.revision) {
				for (const remote of remotes) {
					remoteCodeUrl = Marker.getRemoteCodeUrl(
						remote,
						scmResponse.scm.revision,
						scmResponse.scm.file,
						scmResponse.range.start.line + 1,
						scmResponse.range.end.line + 1
					);

					if (remoteCodeUrl !== undefined) {
						marker.remoteCodeUrl = remoteCodeUrl;
						break;
					}
				}
				Logger.log(`prepareMarkerCreationDescriptor: remote code URL = ${marker.remoteCodeUrl}`);
			}
		} catch (ex) {
			Logger.error(ex);
		}

		Logger.log(`prepareMarkerCreationDescriptor: preparation complete`);
		return {
			marker,
			backtrackedLocation
		};
	}

	static async getKnownCommitHashes(filePath: string): Promise<string[]> {
		const { git } = SessionContainer.instance();
		const commitHistory = await git.getRepoCommitHistory(filePath);
		const firstLastCommits =
			commitHistory.length > 10
				? [...commitHistory.slice(0, 5), ...commitHistory.slice(-5)]
				: commitHistory;
		const branchPoints = await git.getRepoBranchForkCommits(filePath);
		return [...firstLastCommits, ...branchPoints];
	}
}

export interface BacktrackedLocation {
	atDocument: CSMarkerLocation;
	atCurrentCommit: CSMarkerLocation;
	fileContents: string;
	filePath: string;
}

export interface MarkerCreationDescriptor {
	marker: CreateMarkerRequest;
	backtrackedLocation: BacktrackedLocation | undefined;
}
