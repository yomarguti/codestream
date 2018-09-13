"use strict";

import { CSEntity } from "../shared/api.protocol";

interface SequenceGap {
	start: number;
	end: number;
}

export class SequentialSlice<T extends CSEntity> {
	constructor(
		private readonly _data: T[],
		private readonly seqField: keyof T,
		public readonly seqStart: number,
		public readonly seqEnd: number,
		public readonly maxSeq: number
	) {}

	get data(): T[] {
		return this._data.slice(0);
	}

	add(entities: T[]) {
		for (const entity of entities) {
			const seqValue = (entity as any)[this.seqField];
			this._data[seqValue - this.seqStart] = entity;
		}
	}

	getSequenceGaps(): SequenceGap[] {
		const gaps = [];
		const seqLength = this.seqEnd - this.seqStart;
		let gapStart = null;

		for (let i = 0; i < seqLength; i++) {
			const missing = this._data[i] == null;
			if (missing && gapStart == null) {
				gapStart = i + this.seqStart;
			}
			if (!missing && gapStart != null) {
				const gapEnd = i + this.seqStart;
				gaps.push({
					start: gapStart,
					end: gapEnd
				});
				gapStart = null;
			}
		}

		if (gapStart != null) {
			gaps.push({
				start: gapStart,
				end: this.seqEnd
			});
		}

		return gaps;
	}
}
