import Dexie from "dexie";
import { upsert } from "../lib/local-cache";

Dexie.debug = true;
const db = new Dexie("test");
db.version(1).stores({
	records: "id"
});

describe("local-cache", () => {
	describe("upsert", () => {
		afterEach(() => {
			waitsForPromise(() =>
				db.transaction("rw", db.records, () => db.records.each(r => db.records.delete(r.id)))
			);
		});

		describe("when a record with the given primaryKey doesn't exist", () => {
			it("creates a new record and returns a promise resolving with it", () => {
				waitsForPromise(async () => {
					const entry = { id: 1, attr1: "foo" };
					const record = await upsert(db, "records", entry);
					expect(record).toEqual(entry);
				});
			});
		});

		describe("when a record with the given primaryKey already exists", () => {
			it("modifies the record with the changes aand returns a promise resolving with it", () => {
				waitsForPromise(async () => {
					const original = { id: 1, attr1: "foo" };
					await db.records.add(original);
					const changes = { id: 1, attr1: "bar", attr2: "fizz" };
					const record = await upsert(db, "records", changes);
					expect(record).toEqual({ ...original, ...changes });
				});
			});
		});

		describe("when provided a collection of records", () => {
			it("upserts each and returns a collection of the persisted records", () => {
				waitsForPromise(async () => {
					const original1 = { id: 1, attr1: "foo" };
					const original2 = { id: 2, attr1: "bar" };
					await db.records.bulkAdd([original1, original2]);
					const changes1 = { id: 1, attr1: "bar", attr2: "fizz" };
					const changes2 = { id: 2, attr1: "foo", attr2: "fizz" };
					const records = await upsert(db, "records", [changes1, changes2]);
					expect(records).toEqual([changes1, changes2]);
				});
			});
		});
	});
});
