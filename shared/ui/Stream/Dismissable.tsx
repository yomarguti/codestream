import React from "react";
import Button from "./Button";

interface State {}

export interface Props {
	title: string;
	buttonText: string;
	onClick: any;
}

export default class Dismissable extends React.Component<Props, State> {
	static defaultProps = {
		title: "",
		buttonText: "Dismiss"
	};

	render() {
		const { title, children, buttonText, onClick } = this.props;
		return (
			<div className="onboarding-page">
				<form className="standard-form">
					<fieldset className="form-body">
						<div className="outline-box">
							<h2>{title}</h2>
							{children}
							<div id="controls">
								<div className="button-group">
									<Button className="control-button" onClick={onClick}>
										{buttonText}
									</Button>
								</div>
							</div>
						</div>
					</fieldset>
				</form>
			</div>
		);
	}
}
