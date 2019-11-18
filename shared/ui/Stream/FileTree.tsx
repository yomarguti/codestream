import cx from "classnames";
import * as path from "path-browserify";
import React, { useState } from "react";
import styled from "styled-components";
import { useSelector, useDispatch } from "react-redux";
import Icon from "./Icon";

interface Props {
	files: string[];
	indent?: number;
}

const LI = styled.li`
	&[data-depth="0"] {
		padding-left: 60px !important;
	}
	&[data-depth="1"] {
		padding-left: 80px !important;
	}
`;

export const FileTree = (props: Props) => {
	const [nodeClosed, setNodeClosed] = useState({});
	let currentDirectory = "";
	let depth = 1;

	const splitPath = (filename: string): [string, string] => {
		const dir = path.dirname(filename);
		return [dir, path.basename(filename)];
	};

	const toggleClosed = directory => {
		setNodeClosed({ ...nodeClosed, [directory]: !nodeClosed[directory] });
	};

	const renderDirectory = directory => {
		currentDirectory = directory;
		const padding = (props.indent || 0) + depth * 20;
		depth++;
		return (
			<li
				className={cx("directory", { closed: nodeClosed[directory] })}
				onClick={e => toggleClosed(directory)}
				style={{ paddingLeft: padding }}
			>
				<Icon name="chevron-down" />
				{directory}
			</li>
		);
	};

	const renderFile = filePath => {
		const [directory, fileName] = splitPath(filePath);
		return (
			<>
				{directory === currentDirectory || renderDirectory(directory)}
				<li className="file" style={{ paddingLeft: (props.indent || 0) + depth * 20 }}>
					{fileName}
				</li>
			</>
		);
	};

	return props.files.sort().map(file => renderFile(file));
};
