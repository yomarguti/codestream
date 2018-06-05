// @flow
import { Range } from "atom";

export type RangeArray = [[number, number], [number, number]];

type RangeThing = Range | RangeArray;

export type Decoration = {
	destroy(): void
};

export type DisplayMarker = {
	getProperties: () => { [string]: mixed },
	setBufferRange(RangeThing): void,
	setProperties(properties: {}): void,
	destroy: Function
};
