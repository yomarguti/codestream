import React, { PropsWithChildren } from "react";
import styled from "styled-components";
import Icon from "@codestream/webview/Stream/Icon";

type ButtonSize = "default" | "large" | "compact";

const getFontSize = (size?: ButtonSize) => {
	switch (size) {
		case "large":
			return "font-size: 1.15em !important;";
		case "compact":
			return "font-size: 11px !important;";
		case "default":
		default:
			return "font-size: var(--font-size) !important;";
	}
};

const getPadding = (size?: ButtonSize) => {
	switch (size) {
		case "large":
			return "padding: 1px 15px;";
		case "compact":
			return "padding: 1px 5px;";
		case "default":
		default:
			return "padding: 1px 10px;";
	}
};

const getColors = (variant = "primary") => {
	switch (variant) {
		case "secondary": {
			return `
				background-color: rgba(255, 255, 255, 0.07);
				color: var(--text-color);
				:hover {
					background-color: rgba(255, 255, 255, 0.09);
					color: var(--text-color-highlight);
				}
			`;
		}
		case "primary":
		default: {
			return `
				background-color: var(--button-background-color);
				color: var(--button-foreground-color);
				:hover {
					background-color: var(--button-background-color-hover);
				}
			`;
		}
	}
};

export const StyledButton = styled.button<Props>(props => {
	return `
	width: ${props.fillParent ? "100%" : "max-content"};
	${getColors(props.variant)}
	cursor: ${props.isLoading ? "default" : "pointer"};
	display: inline-flex;
	align-items: center;
	justify-content: center ${props.isLoading ? "!important" : ""};
	line-height: 2em;
	user-select: none;
	-webkit-user-select: none;
	white-space: nowrap;
	z-index: 0;
	text-shadow: none;

	${getFontSize(props.size)}
	${getPadding(props.size)}
	border-radius: 0;
	border: 1px solid transparent !important;
	outline: none !important;
`;
});

const ButtonPrepend = styled.div`
	margin-right: 10px;
	.octicon {
		vertical-align: text-bottom;
	}
`;

const ButtonAppend = styled.div`
	justify-self: end;
	justify-content: flex-end;
	flex: 2;
	display: flex;
	margin-left: 10px;
`;

type ButtonVariant = "primary" | "secondary";

interface Props {
	variant?: ButtonVariant;
	disabled?: boolean;
	isLoading?: boolean;
	size?: ButtonSize;
	prependIcon?: React.ReactNode;
	appendIcon?: React.ReactNode;
	onClick?: React.MouseEventHandler;
	fillParent?: boolean;
}

export const Button = (props: PropsWithChildren<Props>) => {
	const { children, onClick, ...rest } = props;

	const internals = (
		<>
			{props.prependIcon && <ButtonPrepend>{props.prependIcon}</ButtonPrepend>}
			<span style={{ textOverflow: "ellipsis", overflow: "hidden" }}>{props.children}</span>
			{props.appendIcon && <ButtonAppend>{props.appendIcon}</ButtonAppend>}
		</>
	);
	return (
		<StyledButton {...rest} onClick={props.isLoading || props.disabled ? undefined : onClick}>
			{props.isLoading ? (
				<>
					<div style={{ opacity: 0, display: "flex" }}>{internals}</div>
					<div style={{ position: "absolute" }}>
						<Icon name="sync" className="spin" />
					</div>
				</>
			) : (
				internals
			)}
		</StyledButton>
	);
};
