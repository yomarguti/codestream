const MarkdownIt = require("markdown-it");
const markdownItSlack = require("markdown-it-slack");
const markdownItEmoji = require("markdown-it-emoji-mart");
import hljs from "highlight.js";

const md = new MarkdownIt({
	breaks: true,
	linkify: true,
	highlight: function(str, lang) {
		if (lang && hljs.getLanguage(lang)) {
			try {
				return '<pre class="hljs"><code>' + hljs.highlight(lang, str, true).value + "</code></pre>";
			} catch (__) {}
		}

		return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + "</code></pre>";
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
	const replaced = md
		.render(text)
		.replace(/blockquote>\n/g, "blockquote>")
		.replace(/<br>\n/g, "\n")
		.replace(/<\/p>\n$/, "</p>");
	// console.log(replaced);
	if (text.trim().match(/^(:[\w_+]+:|\s)+$/))
		return "<span class='only-emoji'>" + replaced + "</span>";
	else return replaced;
};
