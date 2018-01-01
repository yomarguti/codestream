import { resolve } from "../lib/actions/utils";

describe("resolver for modifications to objects", () => {
	it("can handle simple property assignment", () => {
		const changes = {
			name: "foo",
			age: 24,
			"child.age": 5
		};

		expect(resolve({ child: {} }, changes)).toEqual({ name: "foo", age: 24, child: { age: 5 } });
	});

	it("can $set", () => {
		const changes = {
			$set: {
				foo: "bar",
				"child.foo": "childBar"
			}
		};

		expect(resolve({ child: {} }, changes)).toEqual({ foo: "bar", child: { foo: "childBar" } });
	});

	it("can $unset", () => {
		const changes = {
			$unset: {
				foo: true,
				"child.bar": true
			}
		};

		expect(resolve({ foo: "bar", child: { bar: "foo" } }, changes)).toEqual({
			foo: undefined,
			child: { bar: undefined }
		});
	});

	it("can $push", () => {
		const changes = {
			$push: {
				things: 3,
				singleItem: "foo",
				"child.things": 1
			}
		};

		expect(resolve({ things: [1, 2], singleItem: "bar", child: { things: [] } }, changes)).toEqual({
			things: [1, 2, 3],
			singleItem: "bar",
			child: {
				things: [1]
			}
		});
	});

	it("can $pull", () => {
		const changes = {
			$pull: {
				things: 2,
				singleItem: "foo",
				"child.things": 1
			}
		};

		expect(
			resolve({ things: [1, 2], child: { things: [1, 2] }, singleItem: "bar" }, changes)
		).toEqual({
			things: [1],
			child: {
				things: [2]
			},
			singleItem: "bar"
		});
	});

	it("can $addToSet", () => {
		const changes = {
			$addToSet: {
				things: 3,
				otherThings: 4,
				singleItem: "foo",
				newProperty: "a",
				"child.things": 1
			}
		};

		expect(
			resolve(
				{ things: [1, 2], otherThings: [4, 5], singleItem: "bar", child: { things: [] } },
				changes
			)
		).toEqual({
			things: [1, 2, 3],
			otherThings: [4, 5],
			newProperty: ["a"],
			singleItem: "bar",
			child: {
				things: [1]
			}
		});
	});

	it("can $inc", () => {
		const changes = {
			$inc: {
				count: 3,
				newCount: 2,
				"child.count": 1
			}
		};

		expect(resolve({ count: 2, child: { count: 0 } }, changes)).toEqual({
			count: 5,
			newCount: 2,
			child: {
				count: 1
			}
		});
	});
});
