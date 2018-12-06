import React, { Component } from "react";
import { connect } from "react-redux";
import createClassString from "classnames";
import _ from "underscore";
import * as actions from "./actions";
import * as codemarkSelectors from "../reducers/codemarks";
import * as userSelectors from "../reducers/users";
import Icon from "./Icon";
import CancelButton from "./CancelButton";
import ScrollBox from "./ScrollBox";
import Filter from "./Filter";
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

	renderCodemarks = codemarks => {
		if (codemarks.length === 0) return null;
		else {
			return codemarks.map(codemark => {
				console.log(codemark);
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
		const { codemarks, currentUserId, mostRecentSourceFile, fileFilter, typeFilter } = this.props;
		const { thisRepo } = this.state;

		const codemarksInThisFile = codemarks.filter(codemark => {
			const codeBlock = codemark.markers && codemark.markers.length && codemark.markers[0];
			const codeBlockFile = codeBlock && codeBlock.file;
			return (
				!codemark.deactivated && mostRecentSourceFile && codeBlockFile === mostRecentSourceFile
			);
		});
		if (codemarksInThisFile.length === 0) {
			if (!mostRecentSourceFile) return null;
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

	render() {
		let hundred = [...Array(100).keys()];
		return (
			<div>
				{this.renderMain()}
				{hundred.map(index => {
					return (
						<div className="hover-plus" key={index}>
							<Icon name="plus" />
						</div>
					);
				})}
			</div>
		);
	}

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
	return {
		usernames: userSelectors.getUsernames(state),
		codemarks: codemarkSelectors.getTypeFilteredCodemarks(state),
		showMarkers: configs.showMarkers,
		team: teams[context.currentTeamId],
		fileFilter: context.codemarkFileFilter,
		mostRecentSourceFile: context.mostRecentSourceFile
	};
};

export default connect(
	mapStateToProps,
	actions
)(SimpleInlineCodemarks);
