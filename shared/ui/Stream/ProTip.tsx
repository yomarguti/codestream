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

const tips = [
	<span>Adding no:label will show everything without a label.</span>,
	<span>Updated in the last three days: updated:>2020-01-30.</span>,
	<span>Flag tech debt with tagged codemarks.</span>,
	<span>
		Share your work-in-progress as you develop. <a href="">See how.</a>
	</span>,
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
	return (
		<Root>
			<Icon name="light-bulb" />
			<b>Pro Tip!</b> {tips[Math.floor(Math.random() * tips.length)]}
		</Root>
	);
}
