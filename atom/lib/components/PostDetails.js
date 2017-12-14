import React, { Component } from "react";
import Gravatar from "react-gravatar";
import Timestamp from "./Timestamp";
import Post from "./Post";
import createClassString from "classnames";
import Button from "./onboarding/Button";

export default class PostDetails extends Component {
	constructor(props) {
		super(props);
		this.state = {};
		this.diffMarkers = [];
	}

	render() {
		const post = this.props.post;

		if (!post) return null;

		const postClass = createClassString({
			post: true
		});
		// console.log("RENDERING A POST DETAILS: " + postClass);
		console.log(post);

		const applyPatchLabel = this.state.patchApplied ? "Revert" : "Apply Patch";
		const showDiffLabel = this.state.diffShowing ? "Hide Diff" : "Show Diff";
		const hasCodeBlock = post.codeBlocks && post.codeBlocks.length ? true : null;

		return (
			<div className="post-details" id={post.id} ref={ref => (this._div = ref)}>
				<Post post={post} />
				{hasCodeBlock && (
					<div className="button-group">
						<Button
							id="show-diff-button"
							className="control-button"
							tabIndex="2"
							type="submit"
							loading={this.props.loading}
							onClick={this.handleClickShowDiff}
						>
							{showDiffLabel}
						</Button>
						<Button
							id="show-diff-button"
							className="control-button"
							tabIndex="2"
							type="submit"
							loading={this.props.loading}
							onClick={this.handleClickApplyPatch}
						>
							{applyPatchLabel}
						</Button>
					</div>
				)}
			</div>
		);
	}

	dummyRange = () => {
		return [[2, 0], [12, 0]];
	};

	destroyDiffMarkers = () => {
		for (var i = 0; i < this.diffMarkers.length; i++) {
			this.diffMarkers[i].destroy();
		}
		this.diffMarkers = [];
	};

	handleClickShowDiff = async event => {
		if (this.state.diffShowing) {
			this.destroyDiffMarkers();
		} else {
			var editor = atom.workspace.getActiveTextEditor();
			const post = this.props.post;
			const codeBlock = post.codeBlocks[0];
			const range = this.dummyRange(); // FIXME

			let location = post.markerLocation;
			if (location) {
				let range = [[location[0], location[1]], [location[2], location[3]]];
				var marker = editor.markBufferRange(range);
				editor.decorateMarker(marker, { type: "line", class: "git-diff-details-old-highlighted" });
				this.diffMarkers.push(marker);

				this.diffEditor = atom.workspace.buildTextEditor({
					lineNumberGutterVisible: false,
					scrollPastEnd: false
				});

				this.diffEditor.setGrammar(editor.getGrammar());
				this.diffEditor.setText(codeBlock.code.replace(/[\r\n]+$/g, ""));

				var diffDiv = document.createElement("div");
				diffDiv.appendChild(atom.views.getView(this.diffEditor));

				var marker2 = editor.markBufferRange([[range[1][0], 0], [range[1][0], 0]]);
				editor.decorateMarker(marker2, {
					type: "block",
					position: "after",
					item: diffDiv
				});
				this.diffMarkers.push(marker2);

				var marker3 = this.diffEditor.markBufferRange([[0, 0], [200, 0]]);
				this.diffEditor.decorateMarker(marker3, {
					type: "line",
					class: "git-diff-details-new-highlighted"
				});
				this.diffMarkers.push(marker3);
			}
		}
		this.setState({ diffShowing: !this.state.diffShowing });
	};

	handleClickApplyPatch = async event => {
		var editor = atom.workspace.getActiveTextEditor();
		const post = this.props.post;
		const codeBlock = post.codeBlocks[0];
		const range = this.dummyRange(); // FIXME
		if (this.state.patchApplied) {
			// revert
			console.log("Putting it back to: " + this.state.oldCode);
			editor.setTextInBufferRange(range, this.state.oldCode);
		} else {
			// apply patch
			var currentCode = editor.getTextInBufferRange(range);
			console.log("Setting old code to: " + currentCode);
			this.setState({ oldCode: currentCode });
			editor.setTextInBufferRange(range, codeBlock.code);
		}
		this.setState({ patchApplied: !this.state.patchApplied });
	};
}
