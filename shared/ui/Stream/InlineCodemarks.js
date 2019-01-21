import React, { Component } from "react";
import { connect } from "react-redux";
import _ from "underscore";
import * as actions from "./actions";
import * as codemarkSelectors from "../store/codemarks/reducer";
import * as userSelectors from "../store/users/reducer";
import Icon from "./Icon";
import Codemark from "./Codemark";

export class SimpleInlineCodemarks extends Component {
	disposables = [];

	constructor(props) {
		super(props);

		this.state = {
			openPost: null
		};
	}

	componentDidMount() {
		this.props.fetchCodemarks();
		// this.disposables.push(
		// 	EventEmitter.subscribe("interaction:active-editor-changed", this.handleFileChangedEvent)
		// );
	}

	componentWillUnmount() {
		this.disposables.forEach(d => d.dispose());
	}

	handleFileChangedEvent = body => {
		// if (body && body.editor && body.editor.fileName)
		// 	this.setState({ thisFile: body.editor.fileName, thisRepo: body.editor.repoId });
		// else this.setState({ thisFile: null });
	};

	componentDidUpdate(prevProps, prevState) {
		const { textEditorFirstLine = 0 } = this.props;

		if (textEditorFirstLine !== prevProps.textEditorFirstLine) {
			const top = (textEditorFirstLine === 0 ? 1 : textEditorFirstLine + 0.65) * 18;
			// this._scrollDiv.scrollTop = Math.round(top) + "px";
			this._scrolling = true;
			document.getElementsByClassName("inline-codemarks")[0].scrollTop = Math.round(top);
		}
	}

	renderCodemarks = codemarks => {
		if (codemarks.length === 0) return null;
		else {
			return codemarks.map(codemark => {
				return (
					<Codemark
						key={codemark.id}
						codemark={codemark}
						collapsed={this.state.openPost !== codemark.id}
						inline={true}
						currentUserName={this.props.currentUserName || "pez"}
						usernames={this.props.usernames}
						onClick={this.handleClickCodemark}
						onMouseEnter={this.handleHighlightCodemark}
						onMouseLeave={this.handleUnhighlightCodemark}
						action={this.props.postAction}
						query={this.state.q}
					/>
				);
			});
		}
	};

	renderMain() {
		const { codemarks, fileStreamIdToFilterFor } = this.props;

		const codemarksInThisFile = codemarks.filter(codemark => {
			const codeBlock = codemark.markers && codemark.markers.length && codemark.markers[0];
			const codeBlockFileStreamId = codeBlock && codeBlock.fileStreamId;
			return (
				!codemark.deactivated &&
				fileStreamIdToFilterFor &&
				codeBlockFileStreamId === fileStreamIdToFilterFor
			);
		});
		if (codemarksInThisFile.length === 0) {
			if (!fileStreamIdToFilterFor) return null;
			else return null;
			// return (
			// 	<div className="no-codemarks">
			// 		There are no codemarks in {mostRecentSourceFile}.<br />
			// 		<br />
			// 		Create one by selecting code.
			// 	</div>
			// );
		} else return this.renderCodemarks(codemarksInThisFile);
	}

	onScroll = event => {
		if (this._scrolling) {
			this._scrolling = false;
			return;
		}
		const top = event.target.scrollTop;
		// we subtract 27 for two reasons:
		// 1) 18 (one line height) because line numbers start at 1 (1-indexed array vs 0-indexed)
		// 2) 9 is half a line, because we want it to scroll halfway through the line
		const line = Math.round((top - 27) / 18);
		this.props.editorRevealLine(line);
	};

	render() {
		let hundred = [...Array(700).keys()];
		const { textEditorFirstLine = 0 } = this.props;

		const top = (textEditorFirstLine === 0 ? 0 : textEditorFirstLine + 0.65) * -18;
		console.log("Main render codemarks");
		return (
			<div
				className="inline-codemarks vscroll"
				onScroll={this.onScroll}
				ref={ref => (this._scrollDiv = ref)}
			>
				{this.renderMain()}
				{hundred.map(index => {
					return (
						<div onClick={e => this.handleClickPlus(index)} className="hover-plus" key={index}>
							<Icon name="plus" />
						</div>
					);
				})}
			</div>
		);
	}

	handleClickPlus = lineNum => {
		this.props.setNewPostEntry("Spatial View");
		this.props.startCommentOnLine(lineNum, this.props.textEditorUri);
		setTimeout(() => this.props.focusInput(), 500);
	};

	handleClickCodemark = codemark => {
		if (codemark.markers) this.props.showCode(codemark.markers[0], true);
		this.props.setThread(codemark.streamId, codemark.parentPostId || codemark.postId);
		// const isOpen = this.state.openPost === id;
		// if (isOpen) this.setState({ openPost: null });
		// else {
		// this.setState({ openPost: id });
		// }
	};

	handleHighlightCodemark = codemark => {
		if (codemark.markers) this.props.highlightCode(codemark.markers[0], true);
	};

	handleUnhighlightCodemark = codemark => {
		if (codemark.markers) this.props.highlightCode(codemark.markers[0], false);
	};

	toggleStatus = id => {
		this.setState({
			statusPosts: { ...this.state.statusPosts, [id]: !this.state.statusPosts[id] }
		});
	};

	handleClickCreateKnowledge = e => {
		e.stopPropagation();
		this.props.setActivePanel("main");
		setTimeout(() => {
			this.props.runSlashCommand("multi-compose");
		}, 500);
		return;
	};

	handleClickSelectItem = event => {
		event.preventDefault();
		var liDiv = event.target.closest("li");
		if (!liDiv) return; // FIXME throw error
		if (liDiv.id) {
			this.props.setActivePanel("main");
			this.props.setCurrentStream(liDiv.id);
		} else if (liDiv.getAttribute("teammate")) {
			this.props.createStream({ type: "direct", memberIds: [liDiv.getAttribute("teammate")] });
		} else {
			console.log("Unknown LI in handleClickSelectStream: ", event);
		}
	};
}

const mapStateToProps = state => {
	const { context, teams, configs } = state;

	// let fileNameToFilterFor;
	let fileStreamIdToFilterFor;
	if (context.activeFile && context.fileStreamId) {
		// fileNameToFilterFor = context.activeFile;
		fileStreamIdToFilterFor = context.fileStreamId;
	} else if (context.activeFile && !context.fileStreamId) {
		// fileNameToFilterFor = context.activeFile;
	} else {
		// fileNameToFilterFor = context.lastActiveFile;
		fileStreamIdToFilterFor = context.lastFileStreamId;
	}

	return {
		usernames: userSelectors.getUsernames(state),
		codemarks: codemarkSelectors.getTypeFilteredCodemarks(state),
		showMarkers: configs.showMarkers,
		team: teams[context.currentTeamId],
		fileFilter: context.codemarkFileFilter,
		// fileNameToFilterFor,
		fileStreamIdToFilterFor
	};
};

export default connect(
	mapStateToProps,
	actions
)(SimpleInlineCodemarks);
