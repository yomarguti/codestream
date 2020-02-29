import React, { PropsWithChildren } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import VsCodeKeystrokeDispatcher from "../utilities/vscode-keystroke-dispatcher";
import Tooltip from "./Tooltip";
import ScrollBox from "./ScrollBox";
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

	return element as HTMLElement;
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
	padding: 0;
	overflow: auto;

	div.children {
		height: 100%;
		padding: 20px;

		&.vcenter {
			height: inherit;
			display: flex;
			flex-direction: column;
			justify-content: center;
			min-width: 350px;
			max-width: 450px;
			margin: 0 auto;
			padding: 0 20px;
		}
	}
`;

const VerticallyCentered = styled.div``;

interface ModalContextType {
	zIndex: number;
}

export const ModalContext = React.createContext<ModalContextType>({
	zIndex: 52
});

export interface ModalProps {
	onClose?: () => void;
	verticallyCenter?: boolean;
}

export function Modal(props: PropsWithChildren<ModalProps>) {
	const modalRoot = useModalRoot();
	const [context] = React.useState<ModalContextType>(() => ({ zIndex: 3000 }));

	React.useEffect(() => {
		const subscription = VsCodeKeystrokeDispatcher.on("keydown", event => {
			if (event.key === "Escape" && props.onClose) {
				event.stopPropagation();
				props.onClose();
			}
		});

		return () => {
			subscription.dispose();
		};
	}, [props.onClose]);

	return createPortal(
		<ModalContext.Provider value={context}>
			<ModalWrapper>
				{props.onClose && <CancelButton onClick={props.onClose} />}
				<ScrollBox>
					<div className="vscroll">
						<div className={props.verticallyCenter ? "vcenter children" : "children"}>
							{props.children}
						</div>
					</div>
				</ScrollBox>
			</ModalWrapper>
		</ModalContext.Provider>,
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
	right: 7px;
	top: 10px;
	padding: 5px 8px 5px 8px;
	z-index: 30;
	:hover {
		color: var(--text-color-highlight);
		background-color: var(--base-background-color);
	}
`;
