import React from "react";
import ComposeTitles from "./ComposeTitles";
import { FeatureFlag } from "./FeatureFlag";

export const Keybindings = () => {
	return (
		<div key="no-codemarks" className="no-codemarks-container">
			<div className="no-codemarks">
				Discuss code by selecting a range and clicking an icon, or use a shortcut below (
				<a href="https://docs.codestream.com/userguide/gettingStarted/code-discussion-with-codemarks/">
					show me how
				</a>
				).
				<br />
				<br />
				<div className="keybindings">
					<FeatureFlag flag="lightningCodeReviews">
						{isOn => isOn && <div className="function-row">{ComposeTitles.review}</div>}
					</FeatureFlag>
					<div className="function-row">{ComposeTitles.comment}</div>
					<div className="function-row">{ComposeTitles.issue}</div>
					<div className="function-row">{ComposeTitles.link}</div>
					<div className="function-row">{ComposeTitles.privatePermalink}</div>
					<div className="function-row">{ComposeTitles.toggleCodeStreamPanel}</div>
				</div>
			</div>
		</div>
	);
};
