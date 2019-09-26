import styled from "styled-components";
import { StyledButton } from "./Button";

interface Props {
	direction?: "row" | "column";
}

export const ButtonGroup = styled.div<Props>(
	props => `
	width: 100%;
	display: flex;
	justify-content: space-between;
	${StyledButton} {
		margin: 5px;
		justify-content: start;
	}
	${getGroupStyles(props.direction)}
`
);

const getGroupStyles = (direction?: string) => {
	switch (direction) {
		case "column": {
			return `
				flex-direction: column;
				${StyledButton} {
					width: inherit;
				}
				`;
		}
		case "row":
		default: {
			return `
				flex-direction: row;
				flex-wrap: wrap;
				${StyledButton} {
					flex: 1 1 0;
				}
			`;
		}
	}
};
