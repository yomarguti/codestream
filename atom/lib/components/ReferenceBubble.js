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

class ReferenceBubble extends Component {
	subscriptions = new CompositeDisposable();

	componentDidMount() {
		this.marker = this.props.editor.markBufferRange(Range(this.props.location), {
			invalidate: "never"
		});
		this.subscriptions.add(
			this.props.editor.onDidSave(event => {
				console.group(`marker for reference ${this.props.id}`);
				console.log("saved location is", this.props.location);
				console.groupEnd();
				const { start, end } = this.marker.getBufferRange();
				this.props.markerDirtied(this.props.id, Location(end, start));
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
		const { id, postId, onSelect, count, numComments } = this.props;
		return (
			<div onClick={e => onSelect(postId)} key={id} className={`count-${count}`}>
				{numComments > 9 ? "9+" : numComments}
			</div>
		);
	}
}

export default connect(null, actions)(ReferenceBubble);
