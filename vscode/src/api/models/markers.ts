'use strict';
import { CodeStreamSession } from '../session';
import { CSMarkerLocations } from '../types';

export class Markers {

    constructor(
        public readonly session: CodeStreamSession,
        public readonly markers: CSMarkerLocations
    ) {
    }
}
