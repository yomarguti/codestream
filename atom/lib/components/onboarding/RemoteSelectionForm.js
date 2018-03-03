import React, { Component } from "react";
import { FormattedMessage } from "react-intl";
import { connect } from "react-redux";
import Button from "./Button";
import * as onboardingActions from "../../actions/onboarding";

export class RemoteSelectionForm extends Component {
	state = {
		selected: "",
		noSelection: false
	};

	onSubmit = async event => {
		if (this.state.selected !== "") this.props.selectRemote(this.state.selected);
		else this.setState({ noSelection: true });
	};

	render() {
		return (
			<form id="remote-selection-form" onSubmit={this.onSubmit}>
				<h2>
					<FormattedMessage id="remoteSelection.title" defaultMessage="CodeStream" />
				</h2>
				<p>
					<FormattedMessage
						id="remoteSelection.message"
						defaultMessage="Which remote represents the common repository for your team?"
					/>
				</p>
				{this.state.noSelection && (
					<p className="error-message">
						<FormattedMessage
							id="remoteSelection.error.noSelection"
							defaultMessage="Please select a remote."
						/>
					</p>
				)}
				<div id="controls">
					<div className="control-group">
						{this.props.remotes.map(({ name, url }) => (
							<label key={name} className="input-label">
								<div>
									<input
										className="input-radio"
										type="radio"
										name="remote"
										value={url}
										onChange={event => this.setState({ selected: event.target.value })}
										checked={this.state.selected === url}
									/>
									{name}
								</div>
								<div className="option-detail">{url}</div>
							</label>
						))}
					</div>
					<Button id="submit-button" className="control-button" tabIndex="1" type="submit">
						<FormattedMessage id="remoteSelection.submitButton" defaultMessage="NEXT" />
					</Button>
				</div>
			</form>
		);
	}
}

const mapStateToProps = ({ onboarding }) => ({
	...onboarding.props
});
export default connect(mapStateToProps, onboardingActions)(RemoteSelectionForm);
