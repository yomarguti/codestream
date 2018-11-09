import React, { Component } from "react";
import { connect } from "react-redux";
import * as contextActions from "../actions/context";
import _ from "underscore";
import { createStream } from "./actions";
import createClassString from "classnames";
import { getChannelStreamsForTeam } from "../reducers/streams";
import CancelButton from "./CancelButton";
import Button from "./Button";
import Tooltip from "./Tooltip";
import { FormattedMessage } from "react-intl";
import Select from "react-select";
import { isInVscode } from "../utils";
import VsCodeKeystrokeDispatcher from "../utilities/vscode-keystroke-dispatcher";

export class SimpleCreateChannelPanel extends Component {
	constructor(props) {
		super(props);

		this.state = { privacy: "public", name: "", loading: false };
		this._createChannelPanel = React.createRef();
	}

	componentDidMount() {
		if (isInVscode()) {
			this.disposable = VsCodeKeystrokeDispatcher.on("keydown", event => {
				if (event.key === "Escape") {
					this.goToChannels();
				}
			});
		}
	}

	componentDidUpdate(prevProps, prevState) {
		if (this.props.activePanel === "create-channel" && prevProps.activePanel !== "create-channel") {
			setTimeout(() => {
				this.focusNameInput();
			}, 500);
		}
	}

	isNameInvalid = name => {
		if (this.props.isSlackTeam) {
			const nameRegex = new RegExp("[ .~#%&*{}+/:<>?|'\"]");
			return nameRegex.test(name) || name.length > 21;
		} else {
			const nameRegex = new RegExp("[.~#%&*{}+/:<>?|'\"]");
			return nameRegex.test(name);
		}
	};

	focusNameInput = () => {
		const input = document.getElementById("channel-name-input");
		if (input) input.focus();
	};

	tabIndex = () => {
		return global.atom ? this.tabIndexCount++ : "0";
	};

	goToChannels = () => this.props.setActivePanel("channels");

	render() {
		const inactive = this.props.activePanel !== "create-channel";

		const createChannelPanelClass = createClassString({
			panel: true,
			"create-channel-panel": true
		});

		const tooltipTitle = this.props.isSlackTeam
			? "Names must be lowercase, without spaces or periods, and shorter than 22 characters"
			: "We don't support these characters: .~#%&*{}+/:<>?|'\".";

		this.tabIndexCount = 0;
		return (
			<div className={createChannelPanelClass} ref={this._createChannelPanel}>
				<div className="panel-header">
					<CancelButton onClick={this.goToChannels} />
					<span className="panel-title">New Channel</span>
				</div>
				<form id="create-channel-form" className="standard-form vscroll">
					<fieldset className="form-body" disabled={inactive}>
						{this.renderError()}
						<p className="explainer">
							Channels are where your dev team discusses projects, repos, or code in general. You
							might create one channel per repo, or one per client.
						</p>
						<div id="controls">
							<div id="privacy-controls" className="control-group">
								<div className="public-private-hint">
									{this.state.privacy === "private"
										? "This channel can only be joined or viewed by invite."
										: "Anyone on your team can view and join this channel."}
								</div>
								<div
									className={createClassString("switch public-private", {
										checked: this.state.privacy === "private"
									})}
									onClick={this.togglePrivacy}
								/>
							</div>
							<div id="name-controls" className="control-group">
								<label>Channel Name</label>
								<Tooltip title={tooltipTitle} placement="bottom" delay=".5">
									<input
										className="native-key-bindings input-text control"
										type="text"
										name="name"
										tabIndex={this.tabIndex()}
										id="channel-name-input"
										value={this.state.name}
										onChange={e => this.setStateName(e.target.value)}
										onBlur={this.onBlurName}
										required={this.state.nameTouched || this.state.formTouched}
									/>
								</Tooltip>
								{this.renderNameHelp()}
							</div>
							<div id="purpose-controls" className="control-group">
								<label>
									Purpose <span className="optional">(optional)</span>
								</label>
								<input
									className="native-key-bindings input-text control"
									type="text"
									name="purpose"
									tabIndex={this.tabIndex()}
									value={this.state.purpose}
									onChange={e => this.setState({ purpose: e.target.value })}
								/>
							</div>
							<div id="members-controls" className="control-group react-select">
								<label>
									Add Members <span className="optional">(optional)</span>
								</label>
								<Select
									id="input-members"
									name="members"
									tabIndex={this.tabIndex()}
									classNamePrefix="native-key-bindings react-select"
									isMulti={true}
									value={this.state.members || []}
									options={this.props.teammates}
									closeMenuOnSelect={false}
									isClearable={false}
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
									tabIndex={this.tabIndex()}
									type="submit"
									loading={this.state.loading}
									onClick={this.handleClickCreateChannel}
								>
									Create
								</Button>
								<Button
									id="discard-button"
									className="control-button cancel"
									tabIndex={this.tabIndex()}
									type="submit"
									onClick={this.handleClickCancel}
								>
									Cancel
								</Button>
							</div>
						</div>
					</fieldset>
				</form>
			</div>
		);
	}

	togglePrivacy = () => {
		this.setState({ privacy: this.state.privacy === "public" ? "private" : "public" });
	};

	setStateName = name => {
		if (this.props.isSlackTeam) this.setState({ name: name.toLowerCase() });
		else this.setState({ name });
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

	renderNameHelp = () => {
		const { name, nameTouched, formTouched } = this.state;
		if (nameTouched || formTouched)
			if (name.length === 0)
				return (
					<small className="error-message">
						<FormattedMessage id="createChannel.name.required" />
					</small>
				);
			else if (this.isNameInvalid(name))
				return (
					<small className="error-message">
						<FormattedMessage id="createChannel.name.invalid" />
					</small>
				);
	};

	// onBlurPassword = () => this.setState({ passwordTouched: true });

	onBlurName = () => {
		return;
		// this.setState({ nameTouched: true });
	};

	resetForm = () => {
		this.setState({
			privacy: "public",
			name: "",
			purpose: "",
			loading: false,
			members: [],
			nameTouched: false,
			formTouched: false
		});
	};

	handleClickCancel = event => {
		event.preventDefault();
		this.resetForm();
		this.props.setActivePanel("channels");
	};

	isFormInvalid = () => {
		return this.isNameInvalid(this.state.name) || this.state.name.length === 0;
	};

	handleClickCreateChannel = async event => {
		event.preventDefault();
		this.setState({ formTouched: true });
		if (this.isFormInvalid()) return;
		this.setState({ loading: true });

		const { privacy, name, members, purpose } = this.state;
		const memberIds = (members || []).map(member => {
			return member.value;
		});
		await this.props.createStream({ type: "channel", privacy, name, memberIds, purpose });
		this.resetForm();
		// this.props.setActivePanel("channels");
	};
}

const mapStateToProps = ({ context, streams, users, teams }) => {
	const teamMembers = teams[context.currentTeamId].memberIds.map(id => users[id]).filter(Boolean);

	const channelStreams = getChannelStreamsForTeam(streams, context.currentTeamId) || {};

	const members = teamMembers.map(user => {
		return {
			value: user.id,
			label: user.username
		};
	});
	return {
		channelStreams,
		teammates: _.sortBy(members, member => member.label.toLowerCase()),
		team: teams[context.currentTeamId]
	};
};

export default connect(
	mapStateToProps,
	{
		...contextActions,
		createStream
	}
)(SimpleCreateChannelPanel);
