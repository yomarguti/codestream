import { describe, expect, it } from "@jest/globals";
import { escapeHtml, replaceHtml, arrayDiff } from "../../utils";

describe("utils", () => {
	test.each([
		["", ""],
		["just text", "just text"],
		["012345", "012345"],
		["true", "true"],
		["javascript::alert('hi');", "javascript::alert(&#039;hi&#039;);"],
		["<b>bold</b>", "&lt;b&gt;bold&lt;/b&gt;"],
		['"text"', "&quot;text&quot;"],
		["I didn't break it", "I didn&#039;t break it"],
		[
			"Map<string, { [repoId: string]: CSReviewDiffs }>()",
			"Map&lt;string, { [repoId: string]: CSReviewDiffs }&gt;()"
		],
		["1\n2\n3", "1<br/>2<br/>3"],
		[
			'1\n2\n3<b>bold</b>"text"I didn\'t break it',
			"1<br/>2<br/>3&lt;b&gt;bold&lt;/b&gt;&quot;text&quot;I didn&#039;t break it"
		]
	])(".escapeHtml(%s)", (a, expected) => {
		expect(escapeHtml(a)).toBe(expected);
	});

	test.each([
		["", ""],
		["just text", "just text"],
		["012345", "012345"],
		["true", "true"],
		["<div>foo</div>", "foo"],
		["1<br>2<br/>3", "1\n2\n3"]
	])(".replaceHtml(%s)", (a, expected) => {
		expect(replaceHtml(a)).toBe(expected);
	});

	test.each([
		[
			["one", "two", "three"],
			["one", "two", "three", "four"],
			{
				added: ["four"]
			}
		],
		[
			["one", "two", "three"],
			["one", "two"],
			{
				removed: ["three"]
			}
		]
	])(".arrayDiff(%j, %j)", (a, b, expected) => {
		expect(arrayDiff(a, b)).toStrictEqual(expected);
	});
});
