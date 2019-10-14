import React, { PropsWithChildren } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import VsCodeKeystrokeDispatcher from "../utilities/vscode-keystroke-dispatcher";
import Tooltip from "./Tooltip";
import Icon from "./Icon";

const noopElement = document.createElement("span");

const useModalRoot = () => {
	const element = document.querySelector("#modal-root") || noopElement;

	React.useEffect(() => {
		element.classList.add("active");
		return () => {
			element.classList.remove("active");
		};
	}, []);

	return element;
};

export const ModalRoot = React.memo(() => {
	return <div id="modal-root" />;
});

const ModalWrapper = styled.div`
	width: 100%;
	height: 100%;
	position: absolute;
	z-index: 3000;
	left: 0;
	background-color: var(--app-background-color);
	padding: 20px;
	overflow: auto;

	& > div {
		height: 100%;
		padding: 25px 20px;
	}
`;

interface ModalProps {
	onClose: () => void;
}

export function Modal(props: PropsWithChildren<ModalProps>) {
	const modalRoot = useModalRoot();

	React.useEffect(() => {
		const subscription = VsCodeKeystrokeDispatcher.on("keydown", event => {
			if (event.key === "Escape") {
				event.stopPropagation();
				props.onClose();
			}
		});

		return () => {
			subscription.dispose();
		};
	}, [props.onClose]);

	return createPortal(
		<ModalWrapper>
			<CancelButton onClick={props.onClose} />
			<div>{props.children}</div>
		</ModalWrapper>,
		modalRoot
	);
}

const CancelButton = styled(function(props: { onClick: () => void }) {
	// have to pass overlayStyle to bump z-index within #modal-root
	return (
		<Tooltip
			placement="left"
			overlayStyle={{ zIndex: "3000" }}
			title={
				<span>
					Close <span className="keybinding">ESC</span>
				</span>
			}
		>
			<span {...props}>
				<Icon name="x" />
			</span>
		</Tooltip>
	);
})`
	cursor: pointer;
	position: absolute;
	right: 20px;
	padding: 2px 8px 0px 8px;
	:hover {
		color: var(--text-color-highlight);
		background-color: var(--base-background-color);
	}
`;
