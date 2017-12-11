import React, { Component } from "react";
import Gravatar from "react-gravatar";
import Timestamp from "./Timestamp";
import Post from "./Post";
import createClassString from "classnames";
import Button from "./onboarding/Button";

export default class PostDetails extends Component {
	constructor(props) {
		super(props);
		this.state = {
			post: props.post,
			menuOpen: false
		};
	}

	componentDidMount() {}

	render() {
		const { post } = this.state;

		if (!this.props.post) return null;

		const postClass = createClassString({
			post: true
		});
		console.log("RENDERING A POST DETAILS: " + postClass);

		const applyPatchLabel = this.state.patchApplied ? "Revert" : "Apply Patch";

		return (
			<div className="postDetails" id={this.props.post.id} ref={ref => (this._div = ref)}>
				<Post post={this.props.post} />
				{this.props.post.codeblock && (
					<div className="button-group">
						<Button
							id="show-diff-button"
							className="control-button"
							tabIndex="2"
							type="submit"
							loading={this.props.loading}
							onclick={this.handleClickShowDiff}
						>
							Show Diff
						</Button>
						<Button
							id="show-diff-button"
							className="control-button"
							tabIndex="2"
							type="submit"
							loading={this.props.loading}
							onclick={this.handleClickApplyPatch}
						>
							{applyPatchLabel}
						</Button>
					</div>
				)}
			</div>
		);
	}

	handleClickShowDiff = async event => {
		console.log("SHOW DIFF");
	};

	handleClickApplyPatch = async event => {
		event.stopPropagation();
		this.setState({ menuOpen: !this.state.menuOpen });
		console.log("CLICK ON MENU: ");
	};
}
