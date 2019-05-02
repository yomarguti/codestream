import React, { Component } from "react";
import { injectIntl } from "react-intl";
import { connect } from "react-redux";
import { closePanel } from "./actions";
import { configureProvider, connectProvider } from "../store/context/actions";
import CancelButton from "./CancelButton";
import Tooltip from "./Tooltip";
import Button from "./Button";
import createClassString from "classnames";
import { isInVscode } from "../utils";
import VsCodeKeystrokeDispatcher from "../utilities/vscode-keystroke-dispatcher";
import { PROVIDER_MAPPINGS } from "./CrossPostIssueControls/types";

export class ConfigureAzureDevOpsPanel extends Component {
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

	onSubmit = e => {
		e.preventDefault();
		const { providerId } = this.props;
		const { organization } = this.state;
		this.props.configureProvider(providerId, { organization });
		this.props.connectProvider(providerId, true);
	};

	renderError = () => {};

	renderOrganizationHelp = () => {};

	tabIndex = () => {};

	render() {
		const { providerId } = this.props;
		const inactive = false;
		const { name } = this.props.providers[providerId] || {};
		const providerName = PROVIDER_MAPPINGS[name] ? PROVIDER_MAPPINGS[name].displayName : "";
		const placeholder = "acmecorp";
		const getUrl = PROVIDER_MAPPINGS[name] ? PROVIDER_MAPPINGS[name].getUrl : "";
		return (
			<div className="panel configure-provider-panel">
				<form className="standard-form vscroll" onSubmit={this.onSubmit}>
					<div className="panel-header">
						<CancelButton onClick={this.props.closePanel} />
						<span className="panel-title">Configure {providerName}</span>
					</div>
					<fieldset className="form-body" disabled={inactive}>
						<p>
							Name of your Azure DevOps Services organization. For example, if you access Azure
							DevOps Services at https://dev.azure.com/
							<strong>myorg</strong>, you would supply "<strong>myorg</strong>" here
						</p>
						{this.renderError()}
						{getUrl && (
							<p style={{ textAlign: "center" }} className="explainer">
								Not a {providerName} customer yet? <a href={getUrl}>Get {providerName}</a>
							</p>
						)}
						<div id="controls">
							<div id="organization-controls" className="control-group">
								<label>Your {providerName} Organization</label>
								<input
									className="native-key-bindings input-text control"
									type="text"
									name="organization"
									tabIndex={this.tabIndex()}
									value={this.state.organization}
									onChange={e => this.setState({ organization: e.target.value })}
									onBlur={this.onBlurOrganization}
									required={this.state.organizationTouched || this.state.formTouched}
									placeholder={placeholder}
									id="configure-provider-initial-input"
								/>
								{this.renderOrganizationHelp()}
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
	{ closePanel, configureProvider, connectProvider }
)(injectIntl(ConfigureAzureDevOpsPanel));
