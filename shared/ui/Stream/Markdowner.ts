import MarkdownIt from "markdown-it";
import markdownItSlack from "markdown-it-slack";
import markdownItEmoji from "markdown-it-emoji-mart";
import { prettyPrintOne } from "code-prettify";
import { logError } from "../logger";
import { escapeHtml } from "../utils";
import { useSelector, shallowEqual } from "react-redux";
import { getUsernames } from "../store/users/reducer";
import React from "react";
import { CodeStreamState } from "../store";

const md = new MarkdownIt({
	breaks: true,
	linkify: true,
	highlight: function(str, lang) {
		const codeHTML = prettyPrintOne(escapeHtml(str), lang, true);
		return `<pre class="code prettyprint" data-scrollable="true">${codeHTML}</pre>`;
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

const mdPlain = new MarkdownIt({
	breaks: true,
	linkify: true,
	highlight: function(str, lang) {
		const codeHTML = prettyPrintOne(escapeHtml(str), lang, true);
		return `<pre class="code prettyprint" data-scrollable="true">${codeHTML}</pre>`;
	}
})
	.use(markdownItSlack)
	.use(markdownItEmoji);

mdPlain.renderer.rules.emoji = function(token, idx) {
	return token[idx].content;
};

export const emojiPlain = text => {
	return mdPlain.renderInline(text);
};

export const markdownify = (text: string) => {
	try {
		const replaced = md
			.render(text, { references: {} })
			.replace(/blockquote>\n/g, "blockquote>")
			.replace(/<br>\n/g, "\n")
			.replace(/<\/p>\n$/, "</p>")
			.replace(/<\/p>\n/g, "</p><br/>");
		// console.log(replaced);
		if (text.trim().match(/^(:[\w_+]+:|\s)+$/))
			return "<span class='only-emoji'>" + replaced + "</span>";
		else return replaced;
	} catch (error) {
		logError(`Error rendering markdown: ${error.message}`);
		return text;
	}
};

/*
	The returned function will markdownify and highlight usernames.
	This hook loads whatever data it needs from the redux store.
	If configuration options are necessary, either the hook can be modified to accept parameters OR
	the returned callback can expect the parameters
*/
export function useMarkdownifyToHtml() {
	const derivedState = useSelector((state: CodeStreamState) => {
		const currentUser = state.users[state.session.userId!];
		return { currentUserName: currentUser.username, usernames: getUsernames(state) };
	}, shallowEqual);

	return React.useCallback(
		(text: string) => {
			let html: string;
			if (text == null || text === "") {
				html = "";
			} else {
				const me = derivedState.currentUserName;
				html = markdownify(text).replace(/@(\w+)/g, (match, name) => {
					if (
						derivedState.usernames.some(
							n => name.localeCompare(n, undefined, { sensitivity: "accent" }) === 0
						)
					) {
						return `<span class="at-mention${
							me.localeCompare(name, undefined, { sensitivity: "accent" }) === 0 ? " me" : ""
						}">${match}</span>`;
					}

					return match;
				});
			}

			return html;
		},
		[derivedState.usernames]
	);
}
