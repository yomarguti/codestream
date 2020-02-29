import React from "react";
import { PropsWithChildren } from "react";
import styled from "styled-components";

export const MINUTE = 60;
export const HOUR = MINUTE * 60;
export const DAY = 24 * HOUR;
export const WEEK = DAY * 7;
export const MONTH = (DAY * 365) / 12;
export const YEAR = DAY * 365;

export const plural = (word: string, count: number, many?: string): string => {
	if (count == 1) {
		return word;
	} else if (many) {
		return many;
	} else {
		return word + "s";
	}
};

export const distanceOfTimeInWords = (time: number, relativeToNow: boolean = true): string => {
	const now = new Date().getTime();
	let seconds: number = Math.floor((now - time) / 1000);
	const isAgo: boolean = seconds >= 0;

	seconds = Math.abs(seconds);

	if (relativeToNow && seconds < 60) return isAgo ? "just now" : "soon";

	let distance: number;
	let when: string;

	if (seconds < MINUTE) {
		// 1 minute
		when = `${seconds} ${plural("second", seconds)}`;
	} else if (seconds < HOUR) {
		// 1 hour
		distance = Math.floor(seconds / 60);
		when = `${distance} ${plural("minute", distance)}`;
	} else if (seconds < DAY) {
		// 1 day
		distance = Math.round(seconds / (60 * 60));
		when = `${distance} ${plural("hour", distance)}`;
	} else if (seconds < WEEK) {
		// 1 week
		distance = Math.round(seconds / (60 * 60 * 24));
		when = `${distance} ${plural("day", distance)}`;
	} else if (seconds < MONTH) {
		// 1 month
		distance = Math.round(seconds / (60 * 60 * 24 * 7));
		when = `${distance} ${plural("week", distance)}`;
	} else if (seconds < YEAR) {
		// # 1 year
		distance = Math.round(seconds / (60 * 60 * 24 * (365 / 12)));
		when = `${distance} ${plural("month", distance)}`;
	} else {
		distance = Math.round(seconds / (60 * 60 * 24 * 365));
		when = `${distance} ${plural("year", distance)}`;
	}

	if (!relativeToNow) {
		return when;
	} else if (isAgo) {
		return `${when} ago`;
	} else {
		return `in ${when}`;
	}
};

const prettyDateDay = function(time) {
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

const prettyTime = function(time) {
	var prettyTime;
	// time = this.adjustedTime(time, options.timezone_info);
	prettyTime = new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(time);
	prettyTime = prettyTime.replace(/^0:/, "12:");
	return prettyTime;
};

const sameDateAs = (date1, date2) => {
	return (
		date1.getFullYear() == date2.getFullYear() &&
		date1.getMonth() == date2.getMonth() &&
		date1.getDate() == date2.getDate()
	);
};

const renderRelative = () => {};

interface Props {
	position?: "static" | "fixed";
	title?: string;
	relative?: boolean;
	dateOnly?: boolean;
	className?: string;
	time: number;
}

const StyledTime = styled.time`
	color: var(--text-color-subtle);
	font-weight: normal;
	padding-left: 5px;
	// details isn't used in relative timestamps
	.details {
		padding-left: 5px;
		transition: opacity 0.4s;
	}
`;

export default function Timestamp(props: PropsWithChildren<Props>) {
	if (!props.time) return null;

	if (props.relative)
		return <StyledTime className={props.className}>{distanceOfTimeInWords(props.time)}</StyledTime>;

	const timeText = prettyTime(props.time);
	const timeDetails = prettyDateDay(props.time);

	if (props.dateOnly) return <StyledTime className={props.className}>{timeDetails}</StyledTime>;
	else
		return (
			<StyledTime className={props.className}>
				{timeText}
				<span className="details">{timeDetails}</span>
			</StyledTime>
		);
}
