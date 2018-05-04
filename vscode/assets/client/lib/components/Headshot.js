import React, { Component } from "react";
import PropTypes from "prop-types";
import Gravatar from "react-gravatar";
import createClassString from "classnames";

const PopupButton = ({ visible, label, command }) =>
	visible ? (
		<div className="popup-button">
			<a className="menu-item" href={command}>
				{label}
			</a>
		</div>
	) : (
		false
	);

export default class Headshot extends Component {
	static contextTypes = {
		platform: PropTypes.object
	};

	state = { showButton: false };

	componentDidMount() {
		const { platform } = this.context;
		this.subscriptions = platform.createCompositeDisposable();

		let image = this._div.querySelector("img");
		if (image && platform.tooltips) {
			if (this.props.mine) {
				this.subscriptions.add(
					platform.tooltips.add(image, { title: "Right click to change your headshot" })
				);
			} else if (this.props.person.fullName) {
				this.subscriptions.add(platform.tooltips.add(image, { title: this.props.person.fullName }));
			}
		}
	}

	componentWillUnmount() {
		this.subscriptions.dispose();
	}

	render() {
		const person = this.props.person;

		if (!person) return null;

		let defaultImage = encodeURI(
			"https://images.codestream.com/misc/nothing_transparent-36x36.gif"
		);
		let authorInitials = person.username ? person.username.charAt(0) : person.email.charAt(0);
		if (person.fullName) {
			authorInitials = person.fullName.replace(/(\w)\w*/g, "$1").replace(/\s/g, "");
			if (authorInitials.length > 2) authorInitials = authorInitials.substring(0, 2);
		}
		let classNameInitials = "headshot-initials color-" + person.color;

		return (
			<div
				className="headshot"
				ref={ref => (this._div = ref)}
				onMouseEnter={e => {
					clearTimeout(this.closeTimeout);
					this.setState({ showButton: true });
				}}
				onMouseLeave={e => {
					this.closeTimeout = setTimeout(() => this.setState({ showButton: false }), 200);
				}}
			>
				<PopupButton
					visible={this.state.showButton}
					label="Start Live Share"
					command={`command:codestream.vsls.invite?${JSON.stringify({ userIds: person.id })}`}
				/>
				<Gravatar
					className="headshot-gravatar"
					size={this.props.size}
					default={defaultImage}
					protocol="http://"
					email={person.email}
				/>
				<div className={classNameInitials}>{authorInitials}</div>
			</div>
		);
	}
}
