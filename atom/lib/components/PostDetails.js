import React, { Component } from "react";
import Button from "./onboarding/Button";
import { locationToRange } from "../util/Marker";

export default class PostDetails extends Component {
	constructor(props) {
		super(props);
		this.state = {};
		this.diffMarkers = [];
	}

	componentDidMount() {
		window.addEventListener("message", this.handleInteractionEvent, true);

		this.props.post.codeBlocks.forEach(block => {
			window.parent.postMessage(
				{
					type: "codestream:subscription:file-changed",
					body: block
				},
				"*"
			);
		});
		if (this._alert)
			atom.tooltips.add(this._alert, {
				title: "Unknown codeblock location."
			});
	}

	componentWillUnmount() {
		this.props.post.codeBlocks.forEach(block => {
			window.parent.postMessage(
				{
					type: "codestream:unsubscribe:file-changed",
					body: block
				},
				"*"
			);
		});
		window.removeEventListener("message", this.handleInteractionEvent, true);
		this.destroyDiffMarkers();
	}

	handleInteractionEvent = ({ data }) => {
		// foobar always lives with view code.
		// will translate postMessages into events to the views
		// this.foobar.on(, () => {});
		if (data.type === "codestream:publish:file-changed") {
			this.props.post.codeBlocks.forEach(block => {
				if (block.file === data.body.file) this.setState({ showDiffButtons: data.body.hasDiff });
			});
		}
	};

	render() {
		const { post } = this.props;

		if (!post) return null;

		const applyPatchLabel = this.state.patchApplied ? "Revert" : "Apply Patch";
		const showDiffLabel = this.state.diffShowing ? "Hide Diff" : "Show Diff";
		const hasCodeBlock = post.codeBlocks && post.codeBlocks.length ? true : null;

		let alert = null;
		// if a patch has been applied, we treat it as if there is
		// a diff
		let showDiffButtons = this.state.patchApplied;
		// if (post.markerLocation) {
		// 	const code = post.codeBlocks[0].code;
		// 	const editor = atom.workspace.getActiveTextEditor();
		// 	if (editor) {
		// 		const range = locationToRange(post.markerLocation);
		// 		const existingCode = editor.getTextInBufferRange(range);
		// 		if (code !== existingCode) {
		// 			showDiffButtons = true;
		// 		}
		// 	}
		// } else if (hasCodeBlock) {
		// 	// this is the case where we have a codeblock but no marker location
		// 	alert = <span className="icon icon-alert" ref={ref => (this._alert = ref)} />;
		// }

		let commitDiv = null;
		if (hasCodeBlock) {
			commitDiv = (
				<div className="posted-to">
					<label>Posted to:</label> <span>{post.commitHashWhenPosted}</span>
				</div>
			);
			// if (post.commitHashWhenPosted == this.props.currentCommit) {
			// 	commitDiv = <span />;
			// } else {
			// 	commitDiv = (
			// 		<Button
			// 			id="show-version-button"
			// 			className="control-button"
			// 			tabIndex="2"
			// 			type="submit"
			// 			onClick={this.handleShowVersion}
			// 		>
			// 			Warp to {post.commitHashWhenPosted}
			// 		</Button>
			// 	);
			// }
		}

		return (
			<div className="post-details" id={post.id} ref={ref => (this._div = ref)}>
				{alert}
				{!this.state.showDiffButtons &&
					hasCodeBlock && <div className="no-diffs">This codeblock matches current</div>}
				{commitDiv}
				{this.state.showDiffButtons && (
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

	destroyDiffMarkers = () => {
		for (var i = 0; i < this.diffMarkers.length; i++) {
			this.diffMarkers[i].destroy();
		}
		this.diffMarkers = [];
	};

	scrollToLine = line => {
		const editor = atom.workspace.getActiveTextEditor();
		editor.setCursorBufferPosition([line, 0]);
		editor.scrollToBufferPosition([line, 0], {
			center: true
		});
	};

	handleShowVersion = async event => {
		console.log("Showing version...");
	};

	handleClickShowDiff = event => {
		event.preventDefault();
		window.parent.postMessage(
			{
				type: "codestream:interaction:show-diff",
				body: this.props.post.codeBlocks[0]
			},
			"*"
		);
		this.setState({ diffShowing: !this.state.diffShowing });
	};

	handleClickApplyPatch = async event => {
		const editor = atom.workspace.getActiveTextEditor();
		const post = this.props.post;
		const location = post.markerLocation;

		if (location) {
			const range = locationToRange(location);

			this.scrollToLine(range.start.row);

			if (this.state.patchApplied) {
				// revert
				editor.setTextInBufferRange(this.state.oldRange, this.state.oldCode);
			} else {
				// apply patch
				const codeBlock = post.codeBlocks[0];
				var currentCode = editor.getTextInBufferRange(range);
				let oldRange = editor.setTextInBufferRange(range, codeBlock.code);
				this.setState({ oldCode: currentCode, oldRange: oldRange });
			}
			this.setState({ patchApplied: !this.state.patchApplied });
		}
	};
}
