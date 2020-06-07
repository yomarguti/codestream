import { PropsWithChildren } from "react";
import React from "react";
import styled, { CSSProperties } from "styled-components";
import Icon from "../../Stream/Icon";

interface CarouselProps {
	children: React.ReactNode;
	className?: string;
	onChange: Function;
	active: number;
	lastContent: number;
}

interface ContentProps {
	active: boolean;
	children: React.ReactNode;
	className?: string;
}

const Prev = styled.div`
	left: -20px;
	@media only screen and (max-width: 450px) {
		left: -15px;
	}
	@media only screen and (max-width: 350px) {
		left: -10px;
	}
`;
const Next = styled.div`
	right: -20px;
	@media only screen and (max-width: 450px) {
		right: -15px;
	}
	@media only screen and (max-width: 350px) {
		right: -10px;
	}
`;

export const Carousel = styled((props: PropsWithChildren<CarouselProps>) => {
	return (
		<div className={props.className}>
			<Prev
				className={props.active > 0 ? "" : "dim"}
				onClick={() => {
					if (props.active > 0) props.onChange(props.active - 1);
				}}
			>
				<Icon name="chevron-left" />
			</Prev>
			<Next
				className={props.active < props.lastContent ? "" : "dim"}
				onClick={() => {
					if (props.active < props.lastContent) props.onChange(props.active + 1);
				}}
			>
				<Icon name="chevron-right" />
			</Next>
			{props.children}
		</div>
	);
})`
	display: flex;
	margin: 20px 0 20px 0;
	position: relative;
	padding: 0 40px;
	text-align: left;

	${Prev}, ${Next} {
		position: absolute;
		top: 80px;
		width: 40px;
		height: 40px;
		background: rgba(127, 127, 127, 0.25);
		&:hover:not(.dim) {
			background: var(--button-background-color);
		}
		color: var(--button-foreground-color);
		border-radius: 20px;
		display: flex;
		justify-content: center;
		align-items: center;
		cursor: pointer;
		transition: opacity 0.2s;
		&.dim {
			cursor: auto;
			opacity: 0.25;
		}
		user-select: none;
		z-index: 2;
	}
`;

export const Content = styled((props: PropsWithChildren<ContentProps>) => {
	return <div className={props.className}>{props.children}</div>;
})`
	${props => (props.active ? "" : "display:none")}
`;
