import React from "react";

interface State { }

export interface Props {
	title: string;
	children: React.ReactNode;
}

export default class RoadBlock extends React.Component<Props, State> {
	static defaultProps = {
		title: ""
	};

	render() {
		const { title, children } = this.props;
		return (
			<div className="onboarding-page">
				<form className="standard-form">
					<fieldset className="form-body">
						<div className="outline-box">
							<h2>{title}</h2>
							{children}
						</div>
					</fieldset>
				</form>
			</div>
		);
	}
}
