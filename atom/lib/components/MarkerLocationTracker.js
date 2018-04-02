import { CompositeDisposable, File } from "atom";
import { Component } from "react";
import { connect } from "react-redux";
import * as markerLocationActions from "../actions/marker-location";
import { locationToRange } from "../util/Marker";
import { getStreamForRepoAndFile } from "../reducers/streams";

const EMPTY_LOCATION = [1, 1, 1, 1];

const isActiveEditor = editor => {
	if (!editor) {
		return false;
	}
	if (editor !== atom.workspace.getActiveTextEditor()) {
		return false;
	}
	return true;
};

class MarkerLocationTracker extends Component {
	componentDidMount = () => {
		const subscriptions = (this.subscriptions = new CompositeDisposable());
		const editorsObserver = atom.workspace.observeTextEditors(this.editorOpened);
		subscriptions.add(editorsObserver);

		const { editor } = this.props;
		// console.log("componenents/MarkerLocationTracker.js componentDidMount");
		this.calculateLocations(editor);
	};

	componentWillReceiveProps(nextProps) {
		const { editor, markers, currentCommit } = nextProps;

		if (editor && markers) {
			editor.hasNewMarker = false;
			for (const { id, location } of markers) {
				this.createOrUpdateDisplayMarker(editor, {
					id,
					location
				});
			}
			if (editor.hasNewMarker) {
				// console.log(
				// 	"componenents/MarkerLocationTracker.js componentWillReceiveProps has new marker"
				// );
				this.calculateLocations(editor);
			}
		}
	}

	componentDidUpdate = (prevProps, prevState) => {
		const { editor, streamId, currentCommit } = this.props;
		if (editor && streamId) {
			const shouldRecalculate =
				streamId != prevProps.streamId || currentCommit != prevProps.currentCommit;
			if (shouldRecalculate) {
				// console.log("componenents/MarkerLocationTracker.js componentDidUpdate should recalculate");
				this.calculateLocations(editor);
			}
		}
	};

	componentWillUnmount = () => {
		this.subscriptions.dispose();
	};

	editorOpened = editor => {
		this.subscriptions.add(
			editor.getBuffer().onDidReload(() => {
				// console.log("componenents/MarkerLocationTracker.js buffer reloaded");
				this.calculateLocations(editor);
			}),
			editor.onDidStopChanging(() => {
				// console.log("componenents/MarkerLocationTracker.js editor stopped changing");
				this.calculateLocations(editor);
			})
		);
	};

	calculateLocations = editor => {
		const { teamId, streamId, calculateLocations } = this.props;
		if (streamId && isActiveEditor(editor)) {
			// console.log(
			// 	"components/MarkerLocationTracker.js calculateLocations will calculate locations"
			// );
			calculateLocations({ teamId, streamId, text: editor.getText() });
		}
	};

	createOrUpdateDisplayMarker(editor, marker) {
		const displayMarkers = editor.displayMarkers || (editor.displayMarkers = {});
		const markerId = marker.id;
		const displayMarker = displayMarkers[markerId];
		const range = locationToRange(marker.location || EMPTY_LOCATION);

		if (marker.deactivated) {
			if (displayMarker) {
				displayMarker.dispose();
				delete displayMarkers[markerId];
			}
		} else {
			if (displayMarker) {
				displayMarker.setBufferRange(range);
			} else {
				displayMarkers[markerId] = editor.markBufferRange(range);
				editor.hasNewMarker = true;
			}
		}
	}

	render = () => {
		return false;
	};
}

const getMarkersForStream = (streamId, markers, locations, commitHash) => {
	const locationsForStream = locations.byStream[streamId] || {};
	const locationsForCommit = locationsForStream[commitHash] || {};
	return Object.values(markers)
		.filter(marker => marker.streamId === streamId)
		.map(marker => {
			return {
				...marker,
				location: locationsForCommit[marker.id]
			};
		})
		.filter(Boolean);
};

const mapStateToProps = ({ context, streams, markers, markerLocations }) => {
	const stream = getStreamForRepoAndFile(streams, context.currentRepoId, context.currentFile) || {};
	const markersForStream = getMarkersForStream(
		stream.id,
		markers,
		markerLocations,
		context.currentCommit
	);
	return {
		teamId: context.currentTeamId,
		streamId: stream.id,
		currentFile: context.currentFile,
		currentCommit: context.currentCommit,
		markers: markersForStream
	};
};

export default connect(mapStateToProps, {
	...markerLocationActions
})(MarkerLocationTracker);
