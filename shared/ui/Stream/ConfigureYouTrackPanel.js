import React, { Component } from "react";
import { injectIntl } from "react-intl";
import { connect } from "react-redux";
import { closePanel } from "./actions";
import { configureProvider } from "../store/context/actions";
import CancelButton from "./CancelButton";
import Tooltip from "./Tooltip";
import Button from "./Button";
import createClassString from "classnames";
import { isInVscode } from "../utils";
import VsCodeKeystrokeDispatcher from "../utilities/vscode-keystroke-dispatcher";
import { PROVIDER_MAPPINGS } from "./CrossPostIssueControls/types";

export class ConfigureYouTrackPanel extends Component {
	initialState = {};

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

	onSubmit = () => {
		const { providerId } = this.props;
		const { host, token } = this.state;
		console.log("Calling with: ", host, " and ", token);
		return this.props.configureProvider(providerId, { host, token });
	};

	renderError = () => {};

	renderHostHelp = () => {};

	tabIndex = () => {};

	render() {
		const { providerId } = this.props;
		const inactive = false;
		console.log("PROVIDER ID IS: ", providerId);
		console.log("PROVIDERS: ", this.props.providers);
		const { name } = this.props.providers[providerId] || {};
		console.log("NAME IS: ", name);
		const providerName = PROVIDER_MAPPINGS[name] ? PROVIDER_MAPPINGS[name].displayName : "";
		const placeholder = "https://acme.youtrack.com";
		const getUrl = PROVIDER_MAPPINGS[name] ? PROVIDER_MAPPINGS[name].getUrl : "";
		return (
			<div className="panel configure-provider-panel">
				<form className="standard-form vscroll" onSubmit={this.onSubmit}>
					<div className="panel-header">
						<CancelButton onClick={this.props.closePanel} />
						<span className="panel-title">Configure {providerName}</span>
					</div>
					<fieldset className="form-body" disabled={inactive}>
						{this.renderError()}
						{getUrl && (
							<p style={{ textAlign: "center" }} className="explainer">
								Not a {providerName} customer yet? <a href={getUrl}>Get {providerName}</a>
							</p>
						)}
						<div id="controls">
							<div id="host-controls" className="control-group">
								<label>{providerName} Server URL</label>
								<input
									className="native-key-bindings input-text control"
									type="text"
									name="host"
									tabIndex={this.tabIndex()}
									value={this.state.host}
									onChange={e => this.setState({ host: e.target.value })}
									onBlur={this.onBlurHost}
									required={this.state.hostTouched || this.state.formTouched}
									placeholder={placeholder}
									id="configure-provider-initial-input"
								/>
								{this.renderHostHelp()}
							</div>
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
								<label>{providerName} Permanent Token</label>
								<input
									className="native-key-bindings input-text control"
									type="text"
									name="token"
									tabIndex={this.tabIndex()}
									value={this.state.token}
									onChange={e => this.setState({ token: e.target.value })}
								/>
							</div>
							<div className="button-group">
								<Button
									id="save-button"
									className="control-button"
									tabIndex={this.tabIndex()}
									type="submit"
									loading={this.state.loading}
									onClick={this.props.closePanel}
								>
									Submit
								</Button>
								<Button
									id="discard-button"
									className="control-button cancel"
									tabIndex={this.tabIndex()}
									type="submit"
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
	{ closePanel, configureProvider }
)(injectIntl(ConfigureYouTrackPanel));
