import React from "react";

const modifier = navigator.appVersion.includes("Macintosh") ? "^ /" : "Ctrl-Shift-/";
const ComposeTitles = {
	comment: (
		<span>
			<span className="function">Add Comment</span>{" "}
			<span className="keybinding extra-pad">{modifier}</span>
			<span className="keybinding">c</span>
		</span>
	),
	// bookmark: (
	// 	<span>
	// 		<span className="function">Create Bookmark</span>{" "}
	// 		<span className="keybinding extra-pad">{modifier}</span>
	// 		<span className="keybinding">b</span>
	// 	</span>
	// ),
	link: (
		<span>
			<span className="function">Get Permalink</span>{" "}
			<span className="keybinding extra-pad">{modifier}</span>
			<span className="keybinding">p</span>
		</span>
	),
	issue: (
		<span>
			<span className="function">Create Issue</span>{" "}
			<span className="keybinding extra-pad">{modifier}</span>
			<span className="keybinding">i</span>
		</span>
	),
	about: (
		<span>
			Get Info<span className="keybinding extra-pad">{modifier}</span>
			<span className="keybinding">a</span>
		</span>
	),
	toggleCodeStreamPanel: (
		<span>
			<span className="function">Toggle CodeStream Panel</span>{" "}
			<span className="keybinding extra-pad">{modifier}</span>
			<span className="keybinding extra-pad">{modifier}</span>
		</span>
	),
	privatePermalink: (
		<span>
			<span className="function">Copy Private Permalink</span>
			<span className="keybinding extra-pad">{modifier}</span>
			<span className="keybinding extra-pad">⇧ p</span>
		</span>
	)
};

export default ComposeTitles;
