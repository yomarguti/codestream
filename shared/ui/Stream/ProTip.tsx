import React from "react";
import styled from "styled-components";
import Icon from "./Icon";

const Root = styled.div`
	padding: 40px 20px;
	margin: 0 auto;
	text-align: center;
	b {
		padding: 0 5px;
	}
`;
const modifier = navigator.appVersion.includes("Macintosh") ? "^ /" : "Ctrl-Shift-/";
const today = new Date();
const todayFormatted = today.toISOString().substring(0, 10);
const fourDaysAgo = new Date(today.getTime() - 1000 * 60 * 60 * 24 * 4);
const fourDaysAgoFormatted = fourDaysAgo.toISOString().substring(0, 10);

const tips = [
	<span>Adding no:label will show everything without a label.</span>,
	<span>Updated in the last four days: updated:>{fourDaysAgoFormatted}.</span>,
	<span>Created more than four days ago: created:>{fourDaysAgoFormatted}.</span>,
	<span>Created today: created:{todayFormatted}.</span>,
	<span>Flag tech debt with tagged codemarks.</span>,
	<span>Use permalinks to share pointers to code on other platforms such as JIRA.</span>,
	<span>CodeStream's comments can include multiple ranges, even across repos.</span>,
	<span>Encourage new-hires to ask questions with CodeStream.</span>,
	<span>Codemark content can be injected as an inline comment in your code.</span>,
	<span>Set keybindings for codemarks to jump to different code locations</span>,
	<span>
		Share your work-in-progress as you develop. <a href="">See how.</a>
	</span>,
	<span>Create a saved query by typing a search term and clicking the bookmark icon</span>,
	<span>
		Type
		<span className="binding">
			<span className="keybinding extra-pad">{modifier}</span>
			<span className="keybinding">c</span>
		</span>{" "}
		to add a comment on code from anywhere.
	</span>
];

export function ProTip() {
	// update once every 30 seconds
	const index = Math.floor(Date.now() / 30000) % tips.length;
	return (
		<Root>
			<Icon name="light-bulb" />
			<b>Pro Tip!</b> {tips[index]}
		</Root>
	);
}
