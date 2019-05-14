import React, { Component } from "react";
import { injectIntl } from "react-intl";
import { connect } from "react-redux";
import { closePanel } from "./actions";
import { configureProvider, sendIssueServiceConnected, setIssueProvider} from "../store/context/actions";
import CancelButton from "./CancelButton";
import Tooltip from "./Tooltip";
import Button from "./Button";
import createClassString from "classnames";
import { isInVscode } from "../utils";
import VsCodeKeystrokeDispatcher from "../utilities/vscode-keystroke-dispatcher";
import { PROVIDER_MAPPINGS } from "./CrossPostIssueControls/types";

export class ConfigureYouTrackPanel extends Component {
	initialState = {
		baseUrl: "",
		baseUrlTouched: false,
		token: "",
		tokenTouched: false,
		formTouched: false
	};

	state = this.initialState;

	focusInput() {
		document.getElementById("configure-provider-initial-input").focus();
	}

	componentDidMount() {
		if (isInVscode()) {
			this.disposable = VsCodeKeystrokeDispatcher.on("keydown", event => {
				if (event.key === "Escape") {
					this.props.closePanel();
				}
			});
		}
		this.focusInput();
	}

	onSubmit = e => {
		e.preventDefault();
		if (this.isFormInvalid()) return;
		const { providerId } = this.props;
		const { baseUrl, token } = this.state;

		// for YouTrack, configuring is as good as connecting, since we are letting the user
		// set the access token ... sending the fourth argument as true here lets the 
		// configureProvider function know that they can mark YouTrack as connected as soon
		// as the access token entered by the user has been saved to the server
		this.props.configureProvider(providerId, { baseUrl, token }, this.props.fromMenu, true);
		
		this.props.closePanel();
	};

	renderError = () => {};

	onBlurBaseUrl = () => {
		this.setState({ baseUrlTouched: true });
	};

	renderBaseUrlHelp = () => {
		const { baseUrl, baseUrlTouched, formTouched } = this.state;
		if (baseUrlTouched || formTouched) {
			if (baseUrl.length === 0) return <small className="error-message">Required</small>;
		}
	};

	onBlurToken = () => {
		this.setState({ tokenTouched: true });
	};

	renderTokenHelp = () => {
		const { token, tokenTouched, formTouched } = this.state;
		if (tokenTouched || formTouched)
			if (token.length === 0) return <small className="error-message">Required</small>;
	};

	tabIndex = () => {};

	isFormInvalid = () => {
		return this.state.baseUrl.length === 0 || this.state.token.length === 0;
	};

	render() {
		const { providerId } = this.props;
		const inactive = false;
		const { name } = this.props.providers[providerId] || {};
		const providerName = PROVIDER_MAPPINGS[name] ? PROVIDER_MAPPINGS[name].displayName : "";
		const placeholder = "https://myorg.myjetbrains.com";
		const getUrl = PROVIDER_MAPPINGS[name] ? PROVIDER_MAPPINGS[name].getUrl : "";
		return (
			<div className="panel configure-provider-panel">
				<form className="standard-form vscroll" onSubmit={this.onSubmit}>
					<div className="panel-header">
						<CancelButton onClick={this.props.closePanel} />
						<span className="panel-title">Configure {providerName}</span>
					</div>
					<fieldset className="form-body" disabled={inactive}>
						{getUrl && (
							<p style={{ textAlign: "center" }} className="explainer">
								Not a {providerName} customer yet? <a href={getUrl}>Get {providerName}</a>
							</p>
						)}
						{this.renderError()}
						<div id="controls">
							<div id="configure-youtrack-controls" className="control-group">
								<label><strong>{providerName} Base URL</strong></label>
								<label>Please provide the Base URL used by your team to access YouTrack. This can be found under your <a href="https://www.jetbrains.com/help/youtrack/incloud/Domain-Settings.html">Domain Settings</a>.</label>
								<input
									className="native-key-bindings input-text control"
									type="text"
									name="baseUrl"
									tabIndex={this.tabIndex()}
									value={this.state.baseUrl}
									onChange={e => this.setState({ baseUrl: e.target.value })}
									onBlur={this.onBlurBaseUrl}
									required={this.state.baseUrlTouched || this.state.formTouched}
									placeholder={placeholder}
									required={true}
									id="configure-provider-initial-input"
								/>
								{this.renderBaseUrlHelp()}
							</div>
							<br/>
							{false && (
								<div id="username-controls" className="control-group">
									<label>{providerName} Username</label>
									<input
										className="native-key-bindings input-text control"
										type="text"
										name="username"
										tabIndex={this.tabIndex()}
										value={this.state.username}
										onChange={e => this.setState({ username: e.target.value })}
									/>
								</div>
							)}
							<div id="token-controls" className="control-group">
								<label><strong>{providerName} Permanent Token</strong></label>
								<label>Please provide a <a href="https://www.jetbrains.com/help/youtrack/standalone/Manage-Permanent-Token.html">permanent token</a> we can use to access your YouTrack projects and issues.</label>
								<input
									className="native-key-bindings input-text control"
									type="text"
									name="token"
									tabIndex={this.tabIndex()}
									value={this.state.token}
									onChange={e => this.setState({ token: e.target.value })}
									onBlur={this.onBlurToken}
									required={this.state.tokenTouched || this.state.formTouched}
								/>
								{this.renderTokenHelp()}
							</div>
							<div className="button-group">
								<Button
									id="save-button"
									className="control-button"
									tabIndex={this.tabIndex()}
									type="submit"
									loading={this.state.loading}
								>
									Submit
								</Button>
								<Button
									id="discard-button"
									className="control-button cancel"
									tabIndex={this.tabIndex()}
									type="button"
									onClick={this.props.closePanel}
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
}

const mapStateToProps = ({ providers, context, teams }) => {
	return { providers };
};

export default connect(
	mapStateToProps,
	{ closePanel, configureProvider, sendIssueServiceConnected, setIssueProvider }
)(injectIntl(ConfigureYouTrackPanel));
