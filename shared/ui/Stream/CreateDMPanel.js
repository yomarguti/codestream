import React, { Component } from "react";
import { connect } from "react-redux";
import withRepositories from "./withRepositories";
import * as contextActions from "../actions/context";
import _ from "underscore-plus";
import { createStream } from "../actions/stream";
import createClassString from "classnames";
import { getDirectMessageStreamsForTeam } from "../reducers/streams";
import Button from "./onboarding/Button";
import { FormattedMessage } from "react-intl";
import UnexpectedErrorMessage from "./onboarding/UnexpectedErrorMessage";
const { CompositeDisposable } = require("atom");
import Select from "react-select";

const isNameInvalid = name => {
	const nameRegex = new RegExp("^[a-zA-Z0-9_-]+$");
	return nameRegex.test(name) === false;
};

export class SimpleCreateDMPanel extends Component {
	constructor(props) {
		super(props);

		this.state = {};
		this.subscriptions = new CompositeDisposable();
		this._createDMPanel = React.createRef();
	}

	componentDidMount() {}

	componentWillUnmount() {
		this.subscriptions.dispose();
	}

	addToolTip(elementId, key) {
		let div = document.getElementById(elementId);
		this.subscriptions.add(
			atom.tooltips.add(div, {
				title: key,
				placement: "left"
			})
		);
	}

	render() {
		const createDMPanelClass = createClassString({
			panel: true,
			"create-dm-panel": true,
			"off-right": this.props.activePanel !== "create-dm"
		});

		return (
			<div className={createDMPanelClass} ref={this._createDMPanel}>
				<div className="panel-header">
					<span onClick={this.handleClick}>Direct Messages</span>
				</div>
				<form id="create-dm-form" className="standard-form postslist">
					<div className="form-body">
						{this.renderError()}
						<p className="explainer">
							Find or create a private conversation with one or more of your teammates.
						</p>
						<div id="controls">
							<div id="members-controls" className="control-group">
								<label>Find or start a DM</label>
								<Select
									id="input-members"
									name="members"
									classNamePrefix="native-key-bindings react-select"
									isMulti={true}
									value={this.state.members || []}
									options={this.props.teammates}
									closeMenuOnSelect={false}
									isClearable={false}
									placeholder="Enter names..."
									onChange={value => this.setState({ members: value })}
								/>
								{/* <div className="help-link">
								<a onClick={() => this.props.transition("forgotPassword")}>
									<FormattedMessage id="login.forgotPassword" />
								</a>
							</div> */}
							</div>
							<div className="button-group">
								<Button
									id="save-button"
									className="control-button"
									tabIndex="2"
									type="submit"
									loading={this.props.loading}
									onClick={this.handleClickCreateDM}
								>
									Go
								</Button>
								<Button
									id="discard-button"
									className="control-button cancel"
									tabIndex="2"
									type="submit"
									loading={this.props.loading}
									onClick={this.handleClickCancel}
								>
									Cancel
								</Button>
							</div>
						</div>
					</div>
					<div className="channel-list">
						<div className="section">
							<div className="header">Recent Conversations</div>
							{this.renderDirectMessages()}
						</div>
					</div>
				</form>
			</div>
		);
	}

	renderDirectMessages = () => {
		return (
			<ul onClick={this.handleClickSelectStream}>
				{this.props.directMessageStreams.map(stream => {
					let count = this.props.umis.unread[stream.id] || 0;
					let mentions = this.props.umis.mentions[stream.id] || 0;
					return (
						<li
							className={createClassString({
								direct: true,
								unread: count > 0
							})}
							key={stream.id}
							id={stream.id}
						>
							{stream.name}
							<span className="latest-post">1d</span>
						</li>
					);
				})}
			</ul>
		);
	};

	renderError = () => {
		if (!this.props.errors) return null;
		if (this.props.errors.invalidCredentials)
			return (
				<span className="error-message form-error">
					<FormattedMessage id="login.invalid" />
				</span>
			);
		if (this.props.errors.unknown)
			return <UnexpectedErrorMessage classes="error-message page-error" />;
	};

	resetForm = () => {
		this.setState({
			members: "",
			formTouched: false
		});
	};

	handleClickCancel = event => {
		this.resetForm();
		this.props.setActivePanel("channels");
	};

	handleClickSelectStream = event => {
		var liDiv = event.target.closest("li");
		if (!liDiv || !liDiv.id) return; // FIXME throw error
		this.props.setActivePanel("main");
		this.props.setCurrentStream(liDiv.id);
	};

	isFormInvalid = () => {
		return;
		// return isNameInvalid(this.state.name);
	};

	handleClickCreateDM = event => {
		this.setState({ formTouched: true });
		if (this.isFormInvalid()) return;

		const { members } = this.state;
		const memberIds = members
			.map(member => {
				return member.value;
			})
			.filter(Boolean);
		// console.log("MEMBERS ARE: ", memberIds);
		// return;
		this.props.createStream({ type: "direct", memberIds });
		this.resetForm();
		this.props.setActivePanel("channels");
	};
}

const mapStateToProps = ({ context, streams, users, teams, session, umis }) => {
	const teamMembers = teams[context.currentTeamId].memberIds.map(id => users[id]).filter(Boolean);
	const members = teamMembers.map(user => {
		return {
			value: user.id,
			label: user.firstName ? user.firstName + " " + user.lastName : user.username
		};
	});

	const directMessageStreams = _.sortBy(
		getDirectMessageStreamsForTeam(streams, context.currentTeamId, session.userId, users) || [],
		stream => stream.name.toLowerCase()
	);

	return {
		umis,
		directMessageStreams,
		teammates: members,
		team: teams[context.currentTeamId]
	};
};

export default connect(
	mapStateToProps,
	{
		...contextActions,
		createStream
	}
)(SimpleCreateDMPanel);
