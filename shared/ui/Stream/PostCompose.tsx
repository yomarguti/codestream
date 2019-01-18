import * as React from "react";
import Icon from "./Icon";

interface Props {
	openCodemarkForm: Function;
	openDirection: "up" | "down";
	renderMessageInput(props: { [key: string]: any }): JSX.Element;
	onClickClose(): any;
	onSubmit(text: string): any;
	placeholder?: string;
}

interface State {
	text: string;
}

export class PostCompose extends React.Component<Props, State> {
	constructor(props) {
		super(props);
		this.state = { text: "" };
	}

	handleChange = (text: string) => {
		this.setState({
			text
		});
	}

	handleExplandClick = (event: React.SyntheticEvent) => {
		event.preventDefault();
		this.props.openCodemarkForm();
	}

	handleClickClose = (event: React.SyntheticEvent) => {
		event.preventDefault();
		this.props.onClickClose();
	}

	handleSubmit = () => {
		const domParser = new DOMParser();
		const replaceRegex = /<br>|<div>/g;
		const text = domParser.parseFromString(this.state.text.replace(replaceRegex, "\n"), "text/html")
			.documentElement.textContent;

		if (text === null || text.trim().length === 0) return;

		this.props.onSubmit(text);
		this.setState({ text: "" });
	}

	render() {
		return (
			<React.Fragment>
				<div key="1" className="plus-button" onClick={this.handleExplandClick}>
					{this.props.openDirection === "down" ? (
						<Icon name="chevron-down" className="plus" />
					) : (
						<Icon name="chevron-up" className="plus" />
					)}
				</div>
				<div key="2" className="x-button" onClick={this.handleClickClose}>
					<Icon name="x" className="plus" />
				</div>
				{this.props.renderMessageInput({
					text: this.state.text,
					placeholder: this.props.placeholder,
					multiCompose: false,
					onChange: this.handleChange,
					onSubmit: this.handleSubmit
				})}
			</React.Fragment>
		);
	}
}
