import React, { Component } from "react";
import { connect } from "react-redux";
import LineBubbleDecoration from "./LineBubbleDecoration";
import { getStreamsByFileForRepo } from "../../reducers/streams";

class BufferReferences extends Component {
	state = { referencesByLine: {} };
	resizeObserver;

	componentDidMount() {
		this.configureReferences(this.props.references);
		this.configureResizeObserver(this.props.editor);
	}

	componentWillReceiveProps(nextProps) {
		if (nextProps.editor.id !== this.props.editor.id) {
			if (this.resizeObserver) this.resizeObserver.disconnect();
			this.configureResizeObserver(nextProps.editor);
			this.setState(
				() => ({ referencesByLine: {} }),
				() => this.configureReferences(nextProps.references)
			);
		} else this.configureReferences(nextProps.references);
	}

	componentWillUnmount() {
		if (this.resizeObserver) this.resizeObserver.disconnect();
	}

	configureReferences(references) {
		const referencesByLine = {};
		references.filter(reference => !reference.deactivated).forEach(reference => {
			const line = reference.location[0];
			const lineRefs = referencesByLine[line] || [];
			lineRefs.push(reference);

			referencesByLine[line] = lineRefs;
		});
		this.setState({ referencesByLine });
	}

	configureResizeObserver(editor) {
		let scrollViewDiv = editor.component.element.querySelector(".scroll-view");
		if (scrollViewDiv && !this.resizeObserver) {
			this.resizeObserver = new ResizeObserver(() => {
				this.handleResizeWindow(scrollViewDiv);
			});
			this.resizeObserver.observe(scrollViewDiv);
		}
	}

	handleResizeWindow = scrollViewDiv => {
		// if the div has display: none then there will be no width
		if (!scrollViewDiv || !scrollViewDiv.offsetWidth) return;

		let rect = scrollViewDiv.getBoundingClientRect();
		// FIXME -- if there is panel is on the right, then subtract 20 more
		let width = scrollViewDiv.offsetWidth + rect.left;
		console.debug("width should now be ", width);
		let newStyle = ".codestream-comment-popup { left: " + width + "px; }";
		this.addStyleString(newStyle);
		// this.resizeStream();
	};

	// add a style to the document, reusing a style node that we attach to the DOM
	addStyleString(str) {
		let node = document.getElementById("codestream-style-tag") || document.createElement("style");
		node.id = "codestream-style-tag";
		node.innerHTML = str;
		document.body.appendChild(node);
	}

	render() {
		return Object.keys(this.state.referencesByLine).map(line => (
			<LineBubbleDecoration
				key={line}
				line={line}
				editor={this.props.editor}
				references={this.state.referencesByLine[line]}
				position="tail"
				className="codestream-overlay"
			/>
		));
	}
}

const getMarkersForStreamAndCommit = (locationsByCommit = {}, commitHash, markers) => {
	const locations = locationsByCommit[commitHash] || {};
	return Object.keys(locations)
		.map(markerId => {
			const marker = markers[markerId];
			if (marker) {
				return {
					...marker,
					location: locations[markerId]
				};
			} else {
				const message = `No marker for id ${markerId} but there are locations for it. commitHash: ${commitHash}`;
				// Raven.captureMessage(message, {
				// 	logger: "Stream::mapStateToProps::getMarkersForStreamAndCommit",
				// 	extra: {
				// 		location: locations[markerId]
				// 	}
				// });
				console.warn(message);
				return false;
			}
		})
		.filter(Boolean);
};

const mapStateToProps = ({ context, markerLocations, markers, streams }, props) => {
	let references = [];
	const streamsForRepo = getStreamsByFileForRepo(streams, context.currentRepoId);
	if (streamsForRepo) {
		const stream = streamsForRepo[props.repo.relativize(props.editor.getPath())];
		if (stream) {
			references = getMarkersForStreamAndCommit(
				markerLocations.byStream[stream.id],
				context.currentCommit,
				markers
			);
		}
	}
	return { references };
};

export default connect(mapStateToProps)(BufferReferences);
