import { CompositeDisposable } from "atom";
import React, { Component } from "react";
import ReactDOM from "react-dom";
import { connect } from "react-redux";
import * as actions from "../actions/marker";

// turn a codestream flat-array range into the format that atom understands
const Range = location => [[location[0], location[1]], [location[2], location[3]]];
// vice versa
const Location = (headPosition, tailPosition) => {
	const location = [];
	location[0] = tailPosition.row;
	location[1] = tailPosition.column;
	location[2] = headPosition.row;
	location[3] = headPosition.column;
	return location;
};

class MarkerBubbleDecoration extends Component {
	subscriptions = new CompositeDisposable();

	componentDidMount() {
		const props = this.props;
		const options = {
			type: "overlay",
			position: props.position,
			class: props.className,
			item: props.item
		};
		this.decoration = this.props.editor.decorateMarker(this.props.marker, options);
		this.subscriptions.add(
			this.decoration.onDidDestroy(() => {
				this.decoration = null;
				this.subscriptions.dispose();
			})
		);
	}

	componentWillReceiveProps(nextProps) {
		//
	}

	componentWillUnmount() {
		this.decoration && this.decoration.destroy();
		this.subscriptions.dispose();
	}

	render() {
		return null;
	}
}

class MarkerManager extends Component {
	markersByLine = {};
	decoratingMarkers = {};

	componentDidMount() {
		this.configureMarkers();
	}

	componentWillReceiveProps(nextProps) {
		console.log("receiving props", nextProps);
		this.configureMarkers();
	}

	configureMarkers() {
		const editor = atom.workspace.getActiveTextEditor();

		this.props.markers.forEach(marker => {
			const line = marker.location[0];
			const lineMarkers = this.markersByLine[line] || [];
			const existingMarker = lineMarkers.find(m => m.id === marker.id);
			if (existingMarker) {
				// update it
			} else lineMarkers.push(marker);

			this.markersByLine[line] = lineMarkers;

			// const displayMarker = editor.markBufferRange(Range(marker.location), { invalidate: "touch" });

			// displayMarker.onDidChange(event => {
			// 	const post = that.findPostById(codeMarker.postId);
			// 	post.markerLocation = codeMarker.location = that.makeLocation(
			// 		event.newHeadBufferPosition,
			// 		event.newTailBufferPosition
			// 	);
			// 	// TODO update it locally
			// });

			for (let line in this.markersByLine) {
				const markers = this.markersByLine[line];
				let maxLine = line * 1;

				let item = document.createElement("div");
				item.className = "codestream-comment-popup";
				markers.forEach((marker, index) => {
					const bubble = document.createElement("div");
					// we add a "count" class which is the reverse of the index
					// so that bubbles lower in the stacking order can be offset
					// by a few pixels giving a "stacked bubbles" effect in CSS
					bubble.classList.add("count-" + (markers.length - index - 1));
					// bubble.onclick = function() {
					// 	that.selectPost(codeMarker.postId);
					// };
					bubble.innerText = marker.numComments > 9 ? "9+" : marker.numComments;
					item.appendChild(bubble);
					if (marker.location[2] > maxLine) maxLine = marker.location[2] * 1;
				});
				console.log("RANGE IS: " + line + " - " + maxLine);
				const range = [[line * 1, 0], [maxLine + 1, 0]];

				const decoratedMarker = editor.markBufferRange(range, { invalidate: "never" });
				this.decoratingMarkers[decoratedMarker.id] = { marker: decoratedMarker, item: item };

				decoratedMarker.onDidChange(function(event) {
					console.log("in the ondidchange");
					console.log("This is where we should update the markers because they ahve moved");
					// if (event.textChanged) that.checkMarkerDiff(codeMarkers);
				});

				// editor.decorateMarker(decoratedMarker, {
				// 	type: "overlay",
				// 	item: item,
				// 	position: "tail",
				// 	class: "codestream-overlay"
				// });
				this.tooltip = atom.tooltips.add(item, { title: "View comments" });
			}
		});
	}

	render() {
		const editor = atom.workspace.getActiveTextEditor();
		return Object.keys(this.decoratingMarkers)
			.map(id => this.decoratingMarkers[id])
			.map(({ marker, item }) => (
				<MarkerBubbleDecoration
					key={marker.id}
					editor={editor}
					marker={marker}
					position="tail"
					className="codestream-overlay"
					item={item}
				/>
			));
	}
}

export default connect(null, actions)(MarkerManager);
