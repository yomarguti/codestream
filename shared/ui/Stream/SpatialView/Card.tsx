import React, { ReactNode } from "react";
import cx from "classnames";

export function Card(props: { children: ReactNode | ReactNode[]; highlightOnHover?: boolean }) {
	return (
		<div className={cx("card", { "no-hover": props.highlightOnHover === false })}>
			{props.children}
		</div>
	);
}
