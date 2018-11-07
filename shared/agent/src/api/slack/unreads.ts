"use strict";
import { Emitter, Event } from "vscode-languageserver";
import { Logger, TraceLevel } from "../../logger";
import { CSUnreads } from "../../shared/agent.protocol";
import { CSLastReads } from "../../shared/api.protocol";
import { Functions } from "../../system/function";
import { Iterables } from "../../system/iterable";
import { ApiProvider } from "../apiProvider";

export class SlackUnreads {
	private _onDidChange = new Emitter<CSUnreads>();
	get onDidChange(): Event<CSUnreads> {
		return this._onDidChange.event;
	}

	private _lastReads: CSLastReads = Object.create(null);
	private _unreads = new Map<string, { mentions: number; unreads: number }>();

	private _dirty = false;
	private _suspended = false;
	private _values: CSUnreads | undefined;

	constructor(private readonly _api: ApiProvider) {}

	get(): CSUnreads {
		return this.values();
	}

	reset() {
		this.suspend();

		this._lastReads = Object.create(null);
		this._unreads.clear();
	}

	resume() {
		if (!this._suspended) return;

		this._suspended = false;
		this._values = undefined;

		if (this._dirty) {
			this.fireChanged();
		}
	}

	suspend() {
		if (this._suspended) return;

		this._suspended = true;
		this._values = this.values();
	}

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

	async update(streamId: string, postId: string, mentions: number, unreads: number) {
		this._lastReads[streamId] = postId;

		const { preferences } = await this._api.getPreferences();
		if (Functions.safe(() => preferences.mutedStreams[streamId] === true)) return;

		this._unreads.set(streamId, { mentions: mentions, unreads: unreads });

		if (!this._suspended) {
			Logger.debug(
				`Unreads.update(${streamId}):`,
				`lastRead=${postId}, mentions=${mentions}, unreads=${unreads}`
			);
		}

		this.fireChanged();
	}

	private fireChanged() {
		if (this._suspended) {
			this._dirty = true;

			return;
		}

		this._dirty = false;

		const values = this.values();
		if (Logger.level === TraceLevel.Debug) {
			let loggableUnreads = Iterables.join(
				Iterables.filterMap(
					this._unreads.entries(),
					([id, count]) =>
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
		if (this._values !== undefined) return this._values;

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

		return {
			lastReads: this._lastReads,
			mentions: mentions,
			unreads: unreads,
			totalMentions: totalMentions,
			totalUnreads: totalUnreads
		};
	}
}
