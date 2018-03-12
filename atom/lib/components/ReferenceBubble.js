import { CompositeDisposable } from "atom";
import React, { Component } from "react";
import { connect } from "react-redux";
import * as actions from "../actions/marker-location";
import { locationToRange } from "../util/Marker";

const isValid = location => {
	const sameLine = location[0] === location[2];
	const startOfLine = location[1] === 0 && location[3] === 0;
	return !(sameLine && startOfLine);
};

class ReferenceBubble extends Component {
	subscriptions = new CompositeDisposable();

	constructor(props) {
		super(props);
		this.state = {
			isVisible: isValid(props.location)
		};
	}

	componentDidMount() {
		const { location, editor } = this.props;
		const subscriptions = this.subscriptions;
		const range = locationToRange(location);
		const marker = (this.marker = editor.markBufferRange(range, {
			invalidate: "never"
		}));

		subscriptions.add(
			marker.onDidDestroy(() => {
				subscriptions.dispose();
			})
		);
	}

	componentWillUnmount() {
		this.marker.destroy();
		this.subscriptions.dispose();
	}

	onClick = event => {
		this.props.onSelect(this.props.postId);
		this.props.onMarkerClicked(this.props);
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

const mapDispatchToProps = dispatch => ({
	...actions,
	onMarkerClicked: props => dispatch({ type: "MARKER_CLICKED", meta: props })
});
export default connect(null, mapDispatchToProps)(ReferenceBubble);
