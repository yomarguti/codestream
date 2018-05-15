import React, { Component } from "react";
import { connect } from "react-redux";

const isValid = location => {
	const sameLine = location[0] === location[2];
	const startOfLine = location[1] === 0 && location[3] === 0;
	return !(sameLine && startOfLine);
};

class ReferenceBubble extends Component {
	constructor(props) {
		super(props);
		this.state = {
			isVisible: isValid(props.location)
		};
	}

	onClick = event => {
		event.preventDefault();
		const { editor, id, onMarkerClicked, postId, location } = this.props;
		window.parent.postMessage(
			{
				type: "codestream:interaction:marker-selected",
				body: { location, markerId: id, postId, file: editor.getPath() }
			},
			"*"
		);
		// TODO: this takes 200ms on average
		onMarkerClicked(this.props);
	};

	render() {
		if (!this.state.isVisible) return false;

		const { id, count, numComments } = this.props;
		return (
			<div onClick={this.onClick} key={id} className={`count-${count}`}>
				{numComments > 9 ? "9+" : numComments}
			</div>
		);
	}
}

export default connect(null, {
	onMarkerClicked: props => ({ type: "MARKER_CLICKED", meta: props })
})(ReferenceBubble);
