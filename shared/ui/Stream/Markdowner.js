import MarkdownIt from "markdown-it";
import markdownItSlack from "markdown-it-slack";
import markdownItEmoji from "markdown-it-emoji-mart";
import { prettyPrintOne } from "code-prettify";
import { logError } from "../logger";
import { escapeHtml } from "../utils";

const md = new MarkdownIt({
	breaks: true,
	linkify: true,
	highlight: function(str, lang) {
		const codeHTML = prettyPrintOne(escapeHtml(str), lang, true);
		return `<pre class="prettyprint">${codeHTML}</pre>`;
	}
})
	.use(markdownItSlack)
	.use(markdownItEmoji);

md.renderer.rules.emoji = function(token, idx) {
	return '<span class="emoji">' + token[idx].content + "</span>";
};

export const emojify = text => {
	return md.render(text);
};

export const markdownify = text => {
	try {
		const replaced = md
			.render(text, { references: {} })
			.replace(/blockquote>\n/g, "blockquote>")
			.replace(/<br>\n/g, "\n")
			.replace(/<\/p>\n$/, "</p>");
		// console.log(replaced);
		if (text.trim().match(/^(:[\w_+]+:|\s)+$/))
			return "<span class='only-emoji'>" + replaced + "</span>";
		else return replaced;
	} catch (error) {
		logError(`Error rendering markdown: ${error.message}`);
		return text;
	}
};
