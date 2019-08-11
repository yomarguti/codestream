import React, { Component } from "react";
import Headshot from "./Headshot";
import Icon from "./Icon";

// AtMentionsPopup expects an on/off switch determined by the on property
// on = show the popup, off = hide the popup
// a people list, which is the possible list of people to at-mention
// with the format:
// [id, nickname, full name, email, headshot, presence]
// and a prefix, which is used to filter/match against the list
export default class AtMentionsPopup extends Component {
	componentDidUpdate(prevProps, prevState) {
		if (!this._div) return;
		const rect = this._div.parentNode.getBoundingClientRect();
		const height = window.innerHeight;
		if (rect.top < height / 2) {
			this._div.style.top = "90%";
			this._div.style.bottom = "auto";
		} else {
			this._div.style.top = "auto";
			this._div.style.bottom = "110%";
		}
	}

	render() {
		if (!this.props.on) return null;

		const { items, prefix } = this.props;

		return (
			<div className="mentions-popup" ref={ref => (this._div = ref)}>
				<div className="body">
					<div className="matches">
						<Icon onClick={this.close} name="x" className="close" />
						{this.props.on === "slash-commands" ? (
							<span>
								Commands matching{" "}
								<b>
									"/
									{prefix}"
								</b>
							</span>
						) : this.props.on === "channels" ? (
							<span>
								Channels matching{" "}
								<b>
									"#
									{prefix}"
								</b>
							</span>
						) : this.props.on === "emojis" ? (
							<span>
								Emoji matching{" "}
								<b>
									":
									{prefix}"
								</b>
							</span>
						) : (
							<span>
								People matching{" "}
								<b>
									"@
									{prefix}"
								</b>
							</span>
						)}
					</div>
					<ul className="compact at-mentions-list">
						{items.map(item => {
							let className = item.id == this.props.selected ? "hover" : "none";
							// the handleClickPerson event needs to fire onMouseDown
							// rather than onclick because there is a handleblur
							// event on the parent element that will un-render
							// this component
							return (
								<li
									className={className}
									key={item.id}
									onMouseEnter={event => this.handleMouseEnter(item.id)}
									onMouseDown={event => this.handleClickItem(item.id)}
								>
									{item.headshot && <Headshot size={18} person={item.headshot} />}
									<span className="username">{item.identifier}</span>{" "}
									{item.description && <span className="name">{item.description}</span>}
									{item.help && <span className="help">{item.help}</span>}
								</li>
							);
						})}
					</ul>
					<div className="instructions">
						<div>&uarr; or &darr; to navigate</div>
						<div>&crarr; to select</div>
						<div>esc to dismiss</div>
					</div>
				</div>
			</div>
		);
	}

	handleMouseEnter(id) {
		return this.props.handleHoverAtMention(id);
	}

	handleClickItem(id) {
		return this.props.handleSelectAtMention(id);
	}

	close = () => {
		return this.props.handleSelectAtMention("__close");
	};

	handleClick = async event => {
		console.log("CLICK ON MENTION: " + event.target.innerHTML);
	};

	selectFirstAtMention() {
		// FIXME -- how to build this?
	}
}
