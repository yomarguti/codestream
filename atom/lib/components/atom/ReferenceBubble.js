import { CompositeDisposable } from "atom";
import React, { Component } from "react";
import { connect } from "react-redux";
import { locationToRange } from "../../util/Marker";
import { CODESTREAM_VIEW_URI } from "../../codestream-view";

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
		window.addEventListener("message", this.handleInteractionEvent, true);
		const { location, editor } = this.props;
		const subscriptions = this.subscriptions;
		const range = locationToRange(location);
		const marker = (this.marker = editor.markBufferRange(range, {
			invalidate: "never"
		}));

		subscriptions.add(
			marker.onDidDestroy(() => {
				subscriptions.dispose();
			}),
			editor.onDidChangeSelectionRange(() => {
				this.removeContentHighlight();
			})
		);
	}

	componentWillUnmount() {
		window.removeEventListener("message", this.handleInteractionEvent, true);
		this.marker.destroy();
		this.subscriptions.dispose();
	}

	handleInteractionEvent = ({ data }) => {
		if (data.type === "codestream:interaction:thread-selected") {
			if (this.props.postId === data.body.id) {
				this.highlightContent();
			}
		}
		if (data.type === "codestream:interaction:thread-closed") {
			if (this.props.postId === data.body) {
				this.removeContentHighlight();
			}
		}
	};

	onClick = _event => {
		atom.workspace.open(CODESTREAM_VIEW_URI);
		const { onMarkerClicked, postId } = this.props;
		onMarkerClicked(this.props);
		window.parent.postMessage(
			{
				type: "codestream:interaction:marker-selected",
				body: { postId }
			},
			"*"
		);
		this.highlightContent();
	};

	highlightContent() {
		const { editor, location } = this.props;
		const range = locationToRange(location);
		editor.setCursorBufferPosition(range.start);
		editor.scrollToBufferPosition(range.start, {
			center: true
		});

		this.bufferHighlight = editor.decorateMarker(this.marker, {
			type: "highlight",
			class: "codestream-highlight"
		});
	}

	removeContentHighlight = () => this.bufferHighlight && this.bufferHighlight.destroy();

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
	onMarkerClicked: props => dispatch({ type: "MARKER_CLICKED", meta: props })
});
export default connect(null, mapDispatchToProps)(ReferenceBubble);
