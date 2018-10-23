import React, { Component } from "react";
import { connect } from "react-redux";
import * as contextActions from "../actions/context";
import _ from "underscore";
import { createStream, openDirectMessage, setCurrentStream } from "./actions";
import createClassString from "classnames";
import { getDirectMessageStreamsForTeam, getDMName } from "../reducers/streams";
import Button from "./Button";
import { FormattedMessage } from "react-intl";
import Select from "react-select";
import Timestamp from "./Timestamp";
import Icon from "./Icon";
import { isActiveMixin, toMapBy, mapFilter } from "../utils";

export class SimpleCreateDMPanel extends Component {
	constructor(props) {
		super(props);

		this.state = { members: [] };
		this._createDMPanel = React.createRef();
	}

	isActive = isActiveMixin("create-dm", this.constructor.name);

	shouldComponentUpdate(nextProps) {
		return this.isActive(this.props, nextProps);
	}

	render() {
		const inactive = this.props.activePanel !== "create-dm";
		const shrink = this.props.activePanel === "main";

		const createDMPanelClass = createClassString({
			panel: true,
			"create-dm-panel": true,
			shrink,
			"off-right": inactive && !shrink
		});

		return (
			<div className={createDMPanelClass} ref={this._createDMPanel}>
				<div className="panel-header">
					<span
						className="align-right-button"
						onClick={() => this.props.setActivePanel("channels")}
					>
						<Icon name="x" className="clickable" />
					</span>
					<span className="panel-title">Direct Messages</span>
				</div>
				<form id="create-dm-form" className="standard-form postslist vscroll">
					<fieldset className="form-body" disabled={inactive}>
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
									value={this.state.members}
									options={this.props.teammates}
									closeMenuOnSelect={false}
									isClearable={false}
									disabled={inactive}
									placeholder="Enter names..."
									onChange={value => this.setState({ members: value || [] })}
								/>
								{/* <div className="help-link">
								<a onClick={() => this.props.transition("forgotPassword")}>
									<FormattedMessage id="login.forgotPassword" />
								</a>
							</div> */}
							</div>
							<Button
								id="save-button"
								className="control-button"
								tabIndex="2"
								type="submit"
								loading={this.state.loading}
								onClick={this.handleClickCreateDM}
							>
								Go
							</Button>
						</div>
					</fieldset>
					{this.renderDirectMessages()}
				</form>
			</div>
		);
	}

	renderDirectMessages = () => {
		if (this.props.directMessageStreams.length === 0) {
			return null;
		}

		const now = new Date().getTime();
		const futureTimestamp = 32503698000000; // Jan 1, 3000

		let canUseTimestamp = true;
		let dms = this.props.directMessageStreams.map(stream => {
			let count = this.props.umis.unreads[stream.id] || 0;

			const isMeStream = stream.id === this.props.meStreamId;

			let sortName;
			let sortPriority;
			let sortTimestamp;
			if (this.props.isSlackTeam) {
				sortTimestamp = stream.mostRecentPostCreatedAt;
				if (sortTimestamp == null) {
					canUseTimestamp = false;
				}
				sortPriority = stream.priority;

				if (stream.name === "slackbot") {
					// Jan 1, 3000
					sortTimestamp = futureTimestamp + 1;
					sortPriority = 100;
					sortName = ".";
				} else if (isMeStream) {
					sortTimestamp = futureTimestamp;
					sortPriority = 99;
					sortName = "..";
				} else {
					sortName = stream.name ? stream.name.toLowerCase() : "";
				}

				if (count) {
					sortPriority += 1;
					if (sortTimestamp != null) {
						sortTimestamp = now + (now - sortTimestamp);
					}
				}
			} else {
				sortTimestamp = isMeStream
					? futureTimestamp
					: stream.mostRecentPostCreatedAt || stream.modifiedAt || 1;
				sortPriority = 0;

				if (isMeStream) {
					sortName = "..";
				} else {
					sortName = stream.name ? stream.name.toLowerCase() : "";
				}

				if (count) {
					if (sortTimestamp != null) {
						sortTimestamp = now + (now - sortTimestamp);
					}
				}
			}

			return {
				sortName,
				sortPriority,
				sortTimestamp,
				element: (
					<li
						className={createClassString({
							direct: true,
							unread: count > 0
						})}
						key={stream.id}
						id={stream.id}
					>
						{stream.name}
						<Timestamp time={stream.mostRecentPostCreatedAt} />
					</li>
				)
			};
		});

		// Sort the streams by our best priority guess
		if (canUseTimestamp) {
			dms.sort((a, b) => b.sortTimestamp - a.sortTimestamp);
		} else {
			dms.sort((a, b) => a.sortPriority - b.sortPriority);
		}
		if (this.props.isSlackTeam) {
			// then truncate, and then sort by timestamp (if available)
			dms = dms.slice(0, 20);
			dms.sort((a, b) => (b.sortTimestamp || 0) - (a.sortTimestamp || 0));
		}

		return (
			<div className="channel-list">
				<div className="section">
					<div className="header">
						<span style={{ float: "right" }}>Last Post</span>
						Recent DMs
					</div>
					<ul onClick={this.handleClickSelectStream}>{dms.map(stream => stream.element)}</ul>
				</div>
			</div>
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
		// if (this.props.errors.unknown)
		// return <UnexpectedErrorMessage classes="error-message page-error" />;
	};

	resetForm = () => {
		this.setState({
			members: [],
			loading: false,
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
		this.props.openDirectMessage(liDiv.id);
	};

	isFormInvalid = () => {
		return;
		// return isNameInvalid(this.state.name);
	};

	handleClickCreateDM = async event => {
		this.setState({ formTouched: true });
		if (this.isFormInvalid()) return;
		this.setState({ loading: true });

		const { members } = this.state;
		const memberIds = members
			.map(member => {
				return member.value;
			})
			.filter(Boolean);
		// console.log("MEMBERS ARE: ", memberIds);
		// return;
		if (memberIds.length) await this.props.createStream({ type: "direct", memberIds });

		this.resetForm();
	};
}

const mapStateToProps = ({ context, streams, users, teams, session, umis }) => {
	const teamMembers = teams[context.currentTeamId].memberIds.map(id => users[id]).filter(Boolean);
	const members = teamMembers
		.map(user => {
			if (!user.isRegistered || user.deactivated) return null;
			return {
				value: user.id,
				label: user.username
			};
		})
		.filter(Boolean);

	const directMessageStreams = mapFilter(
		getDirectMessageStreamsForTeam(streams, context.currentTeamId) || [],
		stream => {
			if (
				!stream.isClosed ||
				(stream.memberIds != null &&
					stream.memberIds.some(id => users[id] != null && users[id].deactivated))
			) {
				return;
			}

			return {
				...stream,
				name: getDMName(stream, toMapBy("id", teamMembers), session.userId)
			};
		}
	);

	// // the integer 528593114636 is simply a number far, far in the past
	// const directMessageStreams = _.sortBy(
	// 	dmStreams,
	// 	stream => stream.mostRecentPostCreatedAt || 528593114636
	// ).reverse();

	return {
		umis,
		directMessageStreams,
		teammates: _.sortBy(members, member => member.label.toLowerCase()),
		team: teams[context.currentTeamId]
	};
};

export default connect(
	mapStateToProps,
	{
		...contextActions,
		createStream,
		setCurrentStream,
		openDirectMessage
	}
)(SimpleCreateDMPanel);
