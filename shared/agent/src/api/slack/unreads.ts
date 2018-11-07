"use strict";
import { Emitter, Event } from "vscode-languageserver";
import { Logger, TraceLevel } from "../../logger";
import { CSUnreads } from "../../shared/agent.protocol";
import { CSLastReads, CSMePreferences } from "../../shared/api.protocol";
import { Iterables, log } from "../../system";
import { ApiProvider } from "../apiProvider";
import { Functions } from "../../system/function";

export class SlackUnreads {
	private _onDidChange = new Emitter<CSUnreads>();
	get onDidChange(): Event<CSUnreads> {
		return this._onDidChange.event;
	}

	private _lastReads: CSLastReads = Object.create(null);
	private _unreads = new Map<string, { mentions: number; unreads: number }>();

	private _readChanges = new Set<string>();

	constructor(private readonly _api: ApiProvider) {}

	get(): CSUnreads {
		return this.values();
	}

	@log()
	increment(streamId: string, mentioned: boolean) {
		let unreads = this._unreads.get(streamId);
		if (unreads !== undefined) {
			unreads.unreads++;
			if (mentioned) {
				unreads.mentions++;
			}
		} else {
			unreads = { mentions: mentioned ? 1 : 0, unreads: 1 };
			this._unreads.set(streamId, unreads);
		}

		Logger.debug(
			`Unreads.increment(${streamId}):`,
			`mentions=${unreads.mentions}, unreads=${unreads.unreads}`
		);

		this.fireChanged();
	}

	@log()
	async update(streamId: string, lastReadPostId: string, mentions: number, unreads: number) {
		const { preferences } = await this._api.getPreferences();

		const changed = this.updateCore(streamId, lastReadPostId, mentions, unreads, preferences);
		if (changed) {
			this.fireChanged();
		}
	}

	@log()
	async updateFromCounts(counts: {
		channels: { [id: string]: any };
		groups: { [id: string]: any };
		ims: { [id: string]: any };
	}) {
		let changed;

		const { preferences } = await this._api.getPreferences();

		for (const [id, c] of Object.entries(counts.channels)) {
			if (
				this.updateCore(
					id,
					c.last_read,
					c.mention_count_display || 0,
					c.unread_count_display || (c.has_unreads ? 1 : 0),
					preferences
				)
			) {
				changed = true;
			}
		}

		for (const [id, g] of Object.entries(counts.groups)) {
			if (
				this.updateCore(
					id,
					g.last_read,
					g.mention_count_display || 0,
					g.unread_count_display || (g.has_unreads ? 1 : 0),
					preferences
				)
			) {
				changed = true;
			}
		}

		for (const [id, im] of Object.entries(counts.ims)) {
			if (this.updateCore(id, im.last_read, im.dm_count || 0, im.dm_count || 0, preferences)) {
				changed = true;
			}
		}

		if (changed) {
			this.fireChanged();
		}
	}

	private async updateCore(
		streamId: string,
		lastReadPostId: string | undefined,
		mentions: number,
		unreads: number,
		preferences: CSMePreferences | undefined
	) {
		let changed = false;
		if (
			lastReadPostId !== undefined &&
			(this._lastReads[streamId] !== undefined || lastReadPostId !== "0000000000.000000")
		) {
			if (this._lastReads[streamId] !== lastReadPostId) {
				changed = true;
				this._lastReads[streamId] = lastReadPostId;

				this._readChanges.add(streamId);
			}
		}

		if (
			preferences != null &&
			preferences.mutedStreams != null &&
			preferences.mutedStreams[streamId] === true
		) {
			// Make sure the muted stream shows 0 mentions & unreads
			mentions = 0;
			unreads = 0;
		}

		let unreadsChanged = true;
		const previous = this._unreads.get(streamId);
		if (previous != null) {
			if (previous.mentions === mentions && previous.unreads === unreads) {
				unreadsChanged = false;
			}
		} else if (mentions === 0 && unreads === 0) {
			unreadsChanged = false;
		}

		if (unreadsChanged) {
			changed = true;
			this._unreads.set(streamId, { mentions: mentions, unreads: unreads });
		}

		return changed;
	}

	private fireChanged() {
		const values = this.values();
		if (Logger.level === TraceLevel.Debug) {
			let loggableUnreads = Iterables.join(
				Iterables.filterMap(this._unreads.entries(), ([id, count]) =>
					count.mentions > 0 || count.unreads > 0
						? `\t${id} = ${count.mentions} mention(s), ${count.unreads} unread(s)`
						: undefined
				),
				"\n"
			);
			if (loggableUnreads) {
				loggableUnreads = `\n${loggableUnreads}`;
			}

			Logger.debug(
				`Unreads.changed: mentions (${values.totalMentions}), unreads (${
					values.totalUnreads
				})${loggableUnreads}`
			);
		}

		this._onDidChange.fire(values);
	}

	private values(): CSUnreads {
		const mentions = Object.create(null);
		const unreads = Object.create(null);

		let totalMentions = 0;
		let totalUnreads = 0;
		for (const [streamId, unread] of this._unreads) {
			if (unread.mentions > 0) {
				totalMentions += unread.mentions;
				mentions[streamId] = unread.mentions;
			}
			if (unread.unreads > 0) {
				totalUnreads += unread.unreads;
				unreads[streamId] = unread.unreads;
			}
		}

		const lastReads: CSLastReads = Object.create(null);
		for (const streamId of this._readChanges) {
			lastReads[streamId] = this._lastReads[streamId];
		}
		this._readChanges.clear();

		return {
			lastReads: lastReads,
			mentions: mentions,
			unreads: unreads,
			totalMentions: totalMentions,
			totalUnreads: totalUnreads
		};
	}
}
