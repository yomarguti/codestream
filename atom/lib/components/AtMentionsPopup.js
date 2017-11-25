import React, { Component } from "react";
import Gravatar from "react-gravatar";

// AtMentionsPopup expects an on/off switch determined by the on property
// on = show the popup, off = hide the popup
// a people list, which is the possible list of people to at-mention
// with the format:
// [id, nickname, full name, email, headshot, presence]
// and a prefix, which is used to filter/match against the list
export default class AtMentionsPopup extends Component {
	constructor(props) {
		super(props);
		this.state = {};
	}

	componentDidMount() {}

	render() {
		if (!this.props.on) return null;

		const people = this.props.people;

		return (
			<div className="mentions-popup" ref={ref => (this._div = ref)}>
				<div className="body">
					<div className="instructions" onClick={event => this.handleClickInstructions()}>
						People matching <b>"@{this.props.prefix}"</b>
					</div>
					<ul className="at-mentions-list">
						{this.props.people.map(person => {
							let className = person.nick == this.props.selected ? "hover" : "none";
							return (
								<li
									className={className}
									key={person.nick}
									onMouseEnter={event => this.handleMouseEnter(person.nick)}
									onClick={event => this.handleClickPerson(person.nick)}
								>
									<Gravatar
										className="headshot"
										size={18}
										default="retro"
										protocol="http://"
										email={person.email}
									/>
									<span class="nick">{person.nick}</span>{" "}
									<span class="name">{person.fullName}</span>
								</li>
							);
						})}
					</ul>
					<table>
						<tr>
							<td>&uarr; or &darr; to navigate</td>
							<td>&crarr; to select</td>
							<td>esc to dismiss</td>
						</tr>
					</table>
				</div>
			</div>
		);
	}

	handleMouseEnter(nick) {
		return this.props.handleHoverAtMention(nick);
	}

	handleClickPerson(nick) {
		return this.props.handleSelectAtMention(nick);
	}

	handleClickInstructions() {
		return this.props.handleSelectAtMention();
	}

	handleClick = async event => {
		console.log("CLICK ON MENTION: " + event.target.innerHTML);
	};

	selectFirstAtMention() {
		// FIXME -- how to build this?
	}
}
