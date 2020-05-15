import { describe, expect, it } from "@jest/globals";
import { markdownify } from "@codestream/webview/Stream/Markdowner";

describe("markdownify (no options)", () => {
	test.each([
		["", ""],
		["a", "<p>a</p>"],
		["<p>b</p>\n", "<p>&lt;p&gt;b&lt;/p&gt;</p>"],
		[">hello", "<blockquote><p>hello</p></blockquote>"],
	])(".markdownify(%j, %j)", (a, expected) => {
		expect(markdownify(a)).toStrictEqual(expected);
	});
});

describe("markdownify (with options)", () => {
	test.each([["a", "a"]])(".markdownify(%j, %j)", (a, expected) => {
		expect(markdownify(a, { excludeParagraphWrap: true })).toStrictEqual(expected);
	});
});

describe("markdownify (only emoji)", () => {
	it("is only emoji", ()=>{
		expect(markdownify(":+1:", { excludeParagraphWrap: true })).toContain("only-emoji");
	});
});
