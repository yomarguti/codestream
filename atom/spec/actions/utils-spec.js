import { normalize } from "../../lib/actions/utils";

describe("actions/utils", () => {
	describe("normalize()", () => {
		it("de-dasherizes an object", () => {
			return expect(normalize({ _id: 1, _foo: "bar", baz: "baz" })).toEqual({
				id: 1,
				foo: "bar",
				baz: "baz"
			});
		});

		it("de-dasherizes an array of objects", () => {
			const o1 = { _id: 1, _foo: "bar", baz: "baz" };
			const o2 = { _id: 2, foo: "bar", _baz: "baz" };
			return expect(normalize([o1, o2])).toEqual([
				{
					id: 1,
					foo: "bar",
					baz: "baz"
				},
				{
					id: 2,
					foo: "bar",
					baz: "baz"
				}
			]);
		});
	});
});
