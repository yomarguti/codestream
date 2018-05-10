import React, { Component } from "react";
import { connect } from "react-redux";
import LineBubbleDecoration from "./LineBubbleDecoration";
import { getStreamsByFileForRepo } from "../../reducers/streams";

class BufferReferences extends Component {
	state = { referencesByLine: {} };

	componentDidMount() {
		this.configureReferences(this.props.references);
	}

	componentWillReceiveProps(nextProps) {
		if (nextProps.streamId !== this.props.streamId) {
			this.setState(
				() => ({ referencesByLine: {} }),
				() => this.configureReferences(nextProps.references)
			);
		} else this.configureReferences(nextProps.references);
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
	const streamsForRepo = getStreamsByFileForRepo(streams, context.currentRepoId);
	const stream = streamsForRepo[props.repo.relativize(props.editor.getPath())];
	let references = [];
	if (stream) {
		references = getMarkersForStreamAndCommit(
			markerLocations.byStream[stream.id],
			context.currentCommit,
			markers
		);
	}
	return { references };
};

export default connect(mapStateToProps)(BufferReferences);
