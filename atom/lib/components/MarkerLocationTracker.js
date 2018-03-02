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

const shouldRecalculateMarkers = (editor, { streamId }) => {
	if (!isActiveEditor(editor)) {
		return false;
	}
	if (!streamId) {
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
		this.calculateLocations(editor);
	};

	componentWillReceiveProps(nextProps) {
		const { editor, markers } = nextProps;

		if (editor && markers) {
			editor.hasNewMarker = false;
			for (const { id, location } of markers) {
				this.createOrUpdateDisplayMarker(editor, {
					id,
					location
				});
			}

			if (editor.hasNewMarker) {
				this.calculateLocations(editor);
			}
		}
	}

	componentDidUpdate = (prevProps, prevState) => {
		const { editor, streamId } = this.props;
		if (streamId && streamId != prevProps.streamId) {
			this.calculateLocations(editor);
		}
	};

	componentWillUnmount = () => {
		this.subscriptions.dispose();
	};

	editorOpened = editor => {
		this.subscriptions.add(
			editor.getBuffer().onDidReload(() => this.calculateLocations(editor)),
			editor.onDidStopChanging(() => this.calculateLocations(editor))
		);
	};

	calculateLocations = editor => {
		if (!shouldRecalculateMarkers(editor, this.props)) {
			return;
		}

		const { teamId, streamId, calculateLocations } = this.props;

		calculateLocations({ teamId, streamId, text: editor.getText() });
	};

	createOrUpdateDisplayMarker(editor, marker) {
		const displayMarkers = editor.displayMarkers || (editor.displayMarkers = {});
		const markerId = marker.id;
		const displayMarker = displayMarkers[markerId];
		const range = locationToRange(marker.location || EMPTY_LOCATION);

		if (displayMarker) {
			displayMarker.setBufferRange(range);
		} else {
			displayMarkers[markerId] = editor.markBufferRange(range);
			editor.hasNewMarker = true;
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
		markers: markersForStream
	};
};

export default connect(mapStateToProps, {
	...markerLocationActions
})(MarkerLocationTracker);
