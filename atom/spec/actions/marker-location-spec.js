import Dexie from "dexie";
import configureStore from "redux-mock-store";
import thunk from "redux-thunk";
import { dispatch } from "../redux-mocks";
import { markerDirtied, saveMarkerLocations } from "../../lib/actions/marker-location";

const dbName = "marker-location-spec";

Dexie.debug = true;
let db;

describe("marker-location action creators", () => {
	beforeEach(() => {
		db = new Dexie(dbName);
		db.version(1).stores({
			markerLocations: "[streamId+teamId+commitHash]"
		});
	});

	afterEach(() => {
		Dexie.delete(dbName);
	});

	describe("saveMarkerLocations", () => {
		const teamId = "t1";
		const streamId = "s1";
		const markerId = "m1";
		const markerId2 = "m2";
		const commitHash = "c1";
		const location = [7, 0, 13, 0];
		const location2 = [0, 7, 3, 0];

		it("saves locations by streamId+teamId+commitHash", () => {
			const store = configureStore([thunk.withExtraArgument({ db })])();
			const markerLocations = {
				teamId,
				streamId,
				commitHash,
				locations: { [markerId]: location, [markerId2]: location2 }
			};

			waitsForPromise(async () => {
				await store.dispatch(saveMarkerLocations(markerLocations));
				expect(store.getActions()).toContain({
					type: "ADD_MARKER_LOCATIONS",
					payload: markerLocations
				});
				const record = await db.markerLocations.get({ streamId, teamId, commitHash });
				expect(record).toEqual(markerLocations);
			});
		});

		it("updates an existing record for streamId+teamId+commitHash", () => {
			const store = configureStore([thunk.withExtraArgument({ db })])();
			const markerLocations = {
				teamId,
				streamId,
				commitHash,
				locations: { [markerId]: location2 }
			};
			waitsForPromise(async () => {
				await db.markerLocations.add({
					streamId,
					teamId,
					commitHash,
					locations: { [markerId]: location }
				});

				await store.dispatch(saveMarkerLocations(markerLocations));
				expect(store.getActions()).toContain({
					type: "ADD_MARKER_LOCATIONS",
					payload: markerLocations
				});
				const record = await db.markerLocations.get({ streamId, teamId, commitHash });
				expect(record).toEqual(markerLocations);
			});
		});
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
