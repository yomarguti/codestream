"use strict";
import { Range } from "vscode-languageserver";
import { Logger } from "../logger";
import {
	CSLocationArray,
	CSMarker,
	CSMarkerLocation,
	CSMarkerLocations,
	CSMe,
	CSProviderInfos,
	CSSlackProviderInfo,
	CSTeam
} from "../protocol/api.protocol";

export interface MarkerLocationArraysById {
	[id: string]: CSLocationArray;
}

export interface MarkerLocationsById {
	[id: string]: CSMarkerLocation;
}

export namespace MarkerLocation {
	export function empty(): CSMarkerLocation {
		return {
			id: "$transientLocation",
			lineStart: 1,
			colStart: 1,
			lineEnd: 1,
			colEnd: 1,
			meta: {
				startWasDeleted: true,
				endWasDeleted: true,
				entirelyDeleted: true
			}
		};
	}

	export function fromArray(array: CSLocationArray, id: string): CSMarkerLocation {
		return {
			id,
			lineStart: array[0],
			colStart: array[1],
			lineEnd: array[2],
			colEnd: array[3]
		};
	}

	export function fromRange(range: Range): CSMarkerLocation {
		return {
			id: "$transientLocation",
			lineStart: range.start.line + 1,
			colStart: range.start.character + 1,
			lineEnd: range.end.line + 1,
			colEnd: range.end.character + 1
		};
	}

	export function toArray(location: CSMarkerLocation): CSLocationArray {
		return [
			location.lineStart,
			location.colStart,
			location.lineEnd,
			location.colEnd,
			location.meta
		];
	}

	export function toArrayFromRange(range: Range): CSLocationArray {
		return [
			range.start.line + 1,
			range.start.character + 1,
			range.end.line + 1,
			range.end.character + 1,
			undefined
		];
	}

	export function toArraysById(locations: MarkerLocationsById): MarkerLocationArraysById {
		return Object.entries(locations).reduce((m, [id, location]) => {
			m[id] = toArray(location);
			return m;
		}, Object.create(null));
	}

	export function toLocationById(location: CSMarkerLocation): MarkerLocationsById {
		return { [location.id]: location };
	}

	export function toLocationsById(
		markerLocations: CSMarkerLocations | undefined
	): MarkerLocationsById {
		if (markerLocations == null || markerLocations.locations == null) return {};

		return Object.entries(markerLocations.locations).reduce((m, [id, array]) => {
			m[id] = fromArray(array, id);
			return m;
		}, Object.create(null));
	}

	export function toRange(location: CSMarkerLocation): Range {
		return Range.create(
			Math.max(location.lineStart - 1, 0),
			Math.max(location.colStart - 1, 0),
			Math.max(location.lineEnd - 1, 0),
			Math.max(location.colEnd - 1, 0)
		);
	}
}

const remoteProviders: [
	string,
	RegExp,
	(remote: string, ref: string, file: string, start: number, end: number) => string
][] = [
	[
		"github",
		/(?:^|\.)github\.com/i,
		(remote: string, ref: string, file: string, start: number, end: number) =>
			`https://${remote}/blob/${ref}/${file}#L${start}${start !== end ? `-L${end}` : ""}`
	],
	[
		"gitlab",
		/(?:^|\.)gitlab\.com/i,
		(remote: string, ref: string, file: string, start: number, end: number) =>
			`https://${remote}/blob/${ref}/${file}#L${start}${start !== end ? `-${end}` : ""}`
	],
	[
		"bitBucket",
		/(?:^|\.)bitbucket\./i,
		(remote: string, ref: string, file: string, start: number, end: number) =>
			`https://${remote}/src/${ref}/${file}#${file}-${start}${start !== end ? `:${end}` : ""}`
	],
	[
		"azure-devops",
		/(?:^|\.)dev\.azure\.com/i,
		(remote: string, ref: string, file: string, start: number, end: number) =>
			`https://${remote}/commit/${ref}/?_a=contents&path=%2F${file}&line=${start}${
				start !== end ? `&lineEnd=${end}` : ""
			}`
	],
	[
		"vsts",
		/(?:^|\.)?visualstudio\.com$/i,
		(remote: string, ref: string, file: string, start: number, end: number) =>
			`https://${remote}/commit/${ref}/?_a=contents&path=%2F${file}&line=${start}${
				start !== end ? `&lineEnd=${end}` : ""
			}`
	]
];

export namespace Marker {
	export function getRemoteCodeUrl(
		remote: string,
		ref: string,
		file: string,
		startLine: number,
		endLine: number
	): { name: string; url: string } | undefined {
		let url;
		for (const [name, regex, fn] of remoteProviders) {
			if (!regex.test(remote)) continue;

			url = fn(remote, ref, file, startLine, endLine);
			if (url !== undefined) {
				return { name: name, url: url };
			}
		}

		return undefined;
	}

	export function getMissingMarkerIds(
		markers: CSMarker[],
		locations: MarkerLocationsById
	): Set<string> {
		const missingMarkerIds = new Set<string>();
		for (const m of markers) {
			if (!locations[m.id]) {
				missingMarkerIds.add(m.id);
			}
		}
		return missingMarkerIds;
	}

	export function getMissingMarkersByCommit(markers: CSMarker[], locations: MarkerLocationsById) {
		const missingMarkerIds = Marker.getMissingMarkerIds(markers, locations);

		const missingMarkersByCommitHashWhenCreated = new Map<string, CSMarker[]>();
		for (const m of markers) {
			if (!missingMarkerIds.has(m.id)) {
				continue;
			}

			let markersForCommitHash = missingMarkersByCommitHashWhenCreated.get(m.commitHashWhenCreated);
			if (!markersForCommitHash) {
				markersForCommitHash = [];
				missingMarkersByCommitHashWhenCreated.set(m.commitHashWhenCreated, markersForCommitHash);
			}
			Logger.log(`Missing location for marker ${m.id} - will calculate`);
			markersForCommitHash.push(m);
		}
		return missingMarkersByCommitHashWhenCreated;
	}
}

export namespace Team {
	export function isSlack(
		team: CSTeam
	): team is CSTeam & { providerInfo: { slack: CSSlackProviderInfo } } {
		return team.providerInfo != null && team.providerInfo.slack != null;
	}
}

export namespace User {
	export function isSlack(me: CSMe): me is CSMe & { providerInfo: { slack: CSSlackProviderInfo } } {
		return (
			me.providerInfo != null &&
			(me.providerInfo.slack != null ||
				Object.values(me.providerInfo).some(provider => provider.slack != null))
		);
	}

	export function getProviderInfo<T extends CSProviderInfos>(
		me: CSMe,
		teamId: string,
		name: string
	) {
		if (me.providerInfo == null) return undefined;

		const provider = me.providerInfo[teamId];
		if (provider == null) return;

		return provider[name] as T;
	}
}
