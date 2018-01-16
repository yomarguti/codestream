import Dexie from "dexie";
import { dispatch } from "../redux-mocks";
import { markerDirtied } from "../../lib/actions/marker-location";

const dbName = "marker-location-spec";

Dexie.debug = true;
let db;

describe("marker-location action creators", () => {
	beforeEach(() => {
		db = new Dexie(dbName);
		db.version(1).stores({
			markerLocations: "commitHash, streamId"
		});
	});

	afterEach(() => {
		Dexie.delete(dbName);
	});

	describe("dirtied references due to buffer changes", () => {
		it("saves the new location", () => {
			waitsForPromise(async () => {
				await db.markerLocations.add({
					commitHash: "abc1",
					streamId: "s1",
					locations: { marker1: [1, 2, 3, 4] }
				});
				const getState = () => ({ context: { currentCommit: "abc1" } });
				const action = await markerDirtied("marker1", [2, 3, 4, 5])(dispatch, getState, { db });
				const locations = await db.markerLocations.get("abc1");
				expect(locations.locations.marker1).toEqual([1, 2, 3, 4]);
				expect(locations.dirty.marker1).toEqual([2, 3, 4, 5]);
			});
		});
	});
});
