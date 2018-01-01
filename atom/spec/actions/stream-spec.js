import Dexie from "dexie";
import { resolveFromPubnub } from "../../lib/actions/stream";

Dexie.debug = true;
let db;

describe("stream action creators", () => {
	beforeEach(() => {
		db = new Dexie("test1");
		db.version(1).stores({
			streams: "id"
		});
		console.log("setting up db", db);
	});

	afterEach(() => {
		Dexie.delete("test1");
	});

	describe("resolveFromPubnub", () => {
		it("updates the local cache with the changes provided", () => {
			const dispatch = jasmine
				.createSpy("dispatch spy")
				.andCallFake(() => dispatch.mostRecentCall.args[0]);
			const id = "id1";
			const changes = {
				id,
				$set: { foo: "bar" },
				$unset: { oldProperty: true },
				$addToSet: {
					things: 2
				}
			};
			waitsForPromise(async () => {
				await db.streams.add({ id, oldProperty: "ipsum", things: [1] });
				const action = await resolveFromPubnub(changes)(dispatch, null, { db });
				expect(action.payload).toEqual({ id, foo: "bar", things: [1, 2] });
			});
		});
	});
});
