import { CompositeDisposable, File } from "atom";
import { Component } from "react";
import { connect } from "react-redux";
import * as markerLocationActions from "../actions/marker-location";
import * as markerLocationRecalculationActions from "../actions/marker-location-recalculation";
import { locationToRange, rangeToLocation } from "../util/Marker";

class MarkerLocationTracker extends Component {
	componentDidMount = () => {
		this.subscriptions = new CompositeDisposable();
		this.installEditorObserver(this.props);
	};

	componentWillReceiveProps = newProps => {
		this.installEditorObserver(newProps);
	};

	componentWillUnmount = () => {
		this.subscriptions.dispose();
	};

	installEditorObserver = ({ teamId, streamId }) => {
		if (teamId && streamId && !this.editorsObserver) {
			this.editorsObserver = atom.workspace.observeTextEditors(this.editorOpened);
			this.subscriptions.add(this.editorsObserver);
		}
	};

	editorOpened = async editor => {
		const { lastCalculation, updateLastCalculationForFile } = this.props;
		const path = editor.getPath();
		const file = new File(path);
		const hash = await file.getDigest();

		if (lastCalculation[path] !== hash || !editor.displayMarkers) {
			updateLastCalculationForFile(path, hash);
			await this.recalculateMarkers(editor);
		}

		this.subscriptions.add(
			editor.getBuffer().onDidReload(() => this.recalculateMarkers(editor)),
			editor.onDidStopChanging(() => this.saveDirtyMarkerLocations(editor))
		);
	};

	recalculateMarkers = async editor => {
		const props = this.props;

		if (editor.isRecalculatingMarkers) {
			return;
		}

		editor.isRecalculatingMarkers = true;

		if (!editor.displayMarkers) {
			editor.displayMarkers = {};
		}

		const { teamId, streamId } = props;
		const locations = await props.fetchMarkersAndLocations({
			teamId,
			streamId
		});
		for (const markerId of Object.keys(locations)) {
			const location = locations[markerId];
			this.createOrUpdateDisplayMarker(editor, {
				id: markerId,
				location
			});
		}

		editor.isRecalculatingMarkers = false;
	};

	createOrUpdateDisplayMarker(editor, marker) {
		const displayMarkers = editor.displayMarkers;
		const markerId = marker.id;
		const displayMarker = displayMarkers[markerId];
		const range = locationToRange(marker.location);

		if (displayMarker) {
			displayMarker.setBufferRange(range);
		} else {
			displayMarkers[markerId] = editor.markBufferRange(range);
		}
	}

	saveDirtyMarkerLocations() {
		const { streamId, markerDirtied } = this.props;
		const editor = atom.workspace.getActiveTextEditor();
		if (editor.isRecalculatingMarkers) {
			return;
		}
		const displayMarkers = editor.displayMarkers;

		for (const markerId of Object.keys(displayMarkers)) {
			const displayMarker = displayMarkers[markerId];
			const location = rangeToLocation(displayMarker.getBufferRange());
			markerDirtied({ markerId, streamId }, location);
		}
	}

	render = () => {
		return false;
	};
}

const mapStateToProps = state => ({ lastCalculation: state.markerLocationRecalculation });

const mergeProps = (mappedProps, actionProps, props) => ({
	...mappedProps,
	...actionProps,
	...props
});

export default connect(
	mapStateToProps,
	{
		...markerLocationActions,
		...markerLocationRecalculationActions
	},
	mergeProps
)(MarkerLocationTracker);
