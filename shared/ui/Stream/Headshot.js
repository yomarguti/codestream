import React, { Component } from "react";
import Gravatar from "react-gravatar";
import Tooltip from "./Tooltip";

export default class Headshot extends Component {
	state = { img: null };
	_div = React.createRef();

	componentDidMount() {
		const img = this._div.current.querySelector("img");
		if (img) this.setState({ img });
	}

	render() {
		const person = this.props.person;

		if (!person) return null;

		let defaultImage = encodeURI(
			"https://images.codestream.com/misc/nothing_transparent-36x36.gif"
		);
		let authorInitials = person.email.charAt(0);
		if (person.fullName) {
			authorInitials = person.fullName.replace(/(\w)\w*/g, "$1").replace(/\s/g, "");
			if (authorInitials.length > 2) authorInitials = authorInitials.substring(0, 2);
		} else if (person.username) {
			authorInitials = person.username.charAt(0);
		}
		let classNameInitials = "headshot-initials color-" + person.color;

		return (
			<div className="headshot" ref={this._div}>
				{this.state.img && (
					<Tooltip
						title={
							this.props.mine ? "Right click to change your headshot" : this.props.person.fullName
						}
						delay="0"
						target={this.state.img}
					/>
				)}
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
