import { expect } from "chai";
import { describe, it } from "mocha";
import { SequentialSlice } from "../../../src/managers/sequentialSlice";
import { CSEntity } from "../../../src/shared/api.protocol";

describe("SequentialSlice", function() {
	it("detects sequence gaps", function() {
		const data = [
			undefined,
			makePost(2),
			makePost(3),
			undefined,
			undefined,
			undefined,
			makePost(7),
			undefined,
			undefined,
			makePost(10)
		] as TestPost[];
		const slice = new SequentialSlice(data, "seq", 1, 11, 100);
		const gaps = slice.getSequenceGaps();

		expect(gaps).to.have.lengthOf(3);

		const gap_1_2 = gaps[0];
		expect(gap_1_2.start).to.be.equals(1);
		expect(gap_1_2.end).to.be.equals(2);

		const gap_4_7 = gaps[1];
		expect(gap_4_7.start).to.be.equals(4);
		expect(gap_4_7.end).to.be.equals(7);

		const gap_8_10 = gaps[2];
		expect(gap_8_10.start).to.be.equals(8);
		expect(gap_8_10.end).to.be.equals(10);
	});
});

interface TestPost extends CSEntity {
	seq: number;
}

let idSeed = 0;
function makePost(seq: number): TestPost {
	return {
		id: (++idSeed).toString(),
		seq,
		createdAt: new Date().getTime(),
		modifiedAt: new Date().getTime(),
		creatorId: "666"
	};
}
