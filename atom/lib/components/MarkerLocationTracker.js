import { CompositeDisposable, File } from "atom";
import { Component } from "react";
import { connect } from "react-redux";
import * as markerLocationActions from "../actions/marker-location";
import * as markerLocationRecalculationActions from "../actions/marker-location-recalculation";
import { locationToRange, rangeToLocation } from "../util/Marker";
import { getStreamForRepoAndFile } from "../reducers/streams";

const isActiveEditor = editor => {
	const result = editor === atom.workspace.getActiveTextEditor();

	return result;
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

		if (markers) {
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
		const range = locationToRange(marker.location);

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

const mapStateToProps = state => {
	const { streams, context, markerLocationRecalculation } = state;
	const stream = getStreamForRepoAndFile(streams, context.currentRepoId, context.currentFile) || {};
	return {
		teamId: context.currentTeamId,
		streamId: stream.id,
		currentFile: context.currentFile,
		lastCalculation: markerLocationRecalculation
	};
};

export default connect(mapStateToProps, {
	...markerLocationActions,
	...markerLocationRecalculationActions
})(MarkerLocationTracker);
