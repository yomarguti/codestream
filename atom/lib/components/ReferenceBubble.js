import { CompositeDisposable } from "atom";
import React, { Component } from "react";
import { connect } from "react-redux";
import * as actions from "../actions/marker-location";

const Range = location => [[location[0], location[1]], [location[2], location[3]]];
const Location = (headPosition, tailPosition) => {
	const location = [];
	location[0] = tailPosition.row;
	location[1] = tailPosition.column;
	location[2] = headPosition.row;
	location[3] = headPosition.column;
	return location;
};
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
		this.marker = this.props.editor.markBufferRange(Range(this.props.location), {
			invalidate: "never"
		});
		this.subscriptions.add(
			this.props.editor.onDidSave(event => {
				console.group(`marker for reference ${this.props.id}`);
				console.debug("saved location is", this.props.location);
				const { start, end } = this.marker.getBufferRange();
				const newLocation = Location(end, start);
				console.debug("new location is", newLocation);
				this.props.markerDirtied(
					{ markerId: this.props.id, streamId: this.props.streamId },
					newLocation
				);
				this.setState({ isVisible: isValid(newLocation) });
				console.groupEnd();
			}),
			this.marker.onDidDestroy(() => {
				this.subscriptions.dispose();
			})
		);
	}

	componentWillUnmount() {
		this.marker.destroy();
		this.subscriptions.dispose();
	}

	render() {
		if (!this.state.isVisible) return false;

		const { id, postId, onSelect, count, numComments } = this.props;
		return (
			<div onClick={e => onSelect(postId)} key={id} className={`count-${count}`}>
				{numComments > 9 ? "9+" : numComments}
			</div>
		);
	}
}

export default connect(null, actions)(ReferenceBubble);
