import React, { Component } from "react";

export default class Timestamp extends Component {
	constructor(props) {
		super(props);
		this.state = {};
	}

	render() {
		const timeText = this.prettyTime(this.props.time);
		const timeDetails = this.prettyDateDay(this.props.time);

		if (!this.props.time) return null;

		return (
			<time>
				{timeText}
				<span className="details">{timeDetails}</span>
			</time>
		);
	}

	sameDateAs(date1, date2) {
		return (
			date1.getFullYear() == date2.getFullYear() &&
			date1.getMonth() == date2.getMonth() &&
			date1.getDate() == date2.getDate()
		);
	}

	prettyDateDay = function(time, options) {
		options = options || {};
		if (time === 0 || time === null || time === undefined) return "";
		var now = new Date().getTime();
		// now = this.adjustedTime(now, options.timezone_info);
		// time = this.adjustedTime(time, options.timezone_info);
		var today = new Date(now);
		var timeDay = new Date(time);
		if (timeDay.getFullYear() === today.getFullYear()) {
			return new Intl.DateTimeFormat("en", {
				day: "numeric",
				month: "short"
			}).format(time);
		}
		return new Intl.DateTimeFormat("en", {
			day: "numeric",
			month: "short",
			year: "numeric"
		}).format(time);
	};

	prettyTime = function(time, options) {
		options = options || {};
		var prettyTime;
		// time = this.adjustedTime(time, options.timezone_info);
		prettyTime = new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(time);
		prettyTime = prettyTime.replace(/^0:/, "12:");
		return prettyTime;
	};
}
