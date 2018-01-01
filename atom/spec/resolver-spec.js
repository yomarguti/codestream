import { resolve } from "../lib/actions/utils";

describe("resolver for modifications to objects", () => {
	it("can $set", () => {
		const changes = {
			$set: { foo: "bar" }
		};

		expect(resolve({}, changes)).toEqual({ foo: "bar" });
	});

	it("can $unset", () => {
		const changes = {
			$unset: {
				foo: true,
				bar: true
			}
		};

		expect(resolve({ foo: "bar", bar: "foo" }, changes)).toEqual({
			foo: undefined,
			bar: undefined
		});
	});

	it("can $push", () => {
		const changes = {
			$push: {
				things: 3,
				singleItem: "foo"
			}
		};

		expect(resolve({ things: [1, 2], singleItem: "bar" }, changes)).toEqual({
			things: [1, 2, 3],
			singleItem: "bar"
		});
	});

	it("can $pull", () => {
		const changes = {
			$pull: {
				things: 2,
				singleItem: "foo"
			}
		};

		expect(resolve({ things: [1, 2], singleItem: "bar" }, changes)).toEqual({
			things: [1],
			singleItem: "bar"
		});
	});

	it("can $addToSet", () => {
		const changes = {
			$addToSet: {
				things: 3,
				otherThings: 4,
				singleItem: "foo",
				newProperty: "a"
			}
		};

		expect(resolve({ things: [1, 2], otherThings: [4, 5], singleItem: "bar" }, changes)).toEqual({
			things: [1, 2, 3],
			otherThings: [4, 5],
			newProperty: "a",
			singleItem: "bar"
		});
	});

	it("can $inc", () => {
		const changes = {
			$inc: {
				count: 3,
				newCount: 2
			}
		};

		expect(resolve({ count: 2 }, changes)).toEqual({
			count: 5,
			newCount: 2
		});
	});
});
