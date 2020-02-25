import React from "react";
import { useDispatch, useSelector } from "react-redux";
import styled from "styled-components";
import { CodeStreamState } from "../store";
import Icon from "./Icon";
import cx from "classnames";
import * as userSelectors from "../store/users/reducer";

const Root = styled.div`
	.octicon-alert {
		margin-right: 5px;
	}
`;

interface Props {
	file: string;
	repoId: string;
}
export const FileInfo = (props: Props) => {
	const derivedState = useSelector((state: CodeStreamState) => {
		const teamMembers = userSelectors.getTeamMembers(state);
		const teamId = state.context.currentTeamId;
		let modifiedByMe = false;
		let modifiedByOthers = false;
		const editingThisFile = teamMembers
			.map(user => {
				const modifiedRepos = user.modifiedRepos ? user.modifiedRepos[teamId] || [] : [];
				const repo = modifiedRepos.find(r => r.repoId === props.repoId);
				if (!repo) return null;
				const file = repo.modifiedFiles.find(f => f.file === props.file);
				if (file) {
					if (user.id === state.session.userId) {
						modifiedByMe = true;
						return null;
					} else {
						modifiedByOthers = true;
						return { user, file, repo };
					}
				} else return null;
			})
			.filter(Boolean);
		const hasConflict = modifiedByMe && modifiedByOthers;
		return { editingThisFile, modifiedByMe, modifiedByOthers, hasConflict };
	});

	const makeNameList = (records, hasConflict) => {
		let message: React.ReactElement = <></>;

		const names = records.map(r => r.user.fullName);
		if (hasConflict) {
			const branch = records[0].repo.branch;
			if (names.length == 1)
				message = (
					<>
						Potential merge conflict with {names[0]} on branch {branch}
					</>
				);
			else if (names.length == 2)
				message = (
					<>
						Potential merge conflict with {names[0]} and {names[1]}
					</>
				);
			else if (names.length > 2) {
				let last = names.pop();
				message = (
					<>
						Potential merge conflict with {names.join(", ")}, and {last}
					</>
				);
			}
		} else {
			if (names.length == 1) {
				const branch = records[0].repo.branch;
				message = (
					<>
						{names[0]} is editing this file on branch {branch}
					</>
				);
			} else if (names.length == 2)
				message = (
					<>
						{names[0]} and {names[1]} are editing this file
					</>
				);
			else if (names.length > 2) {
				let last = names.pop();
				message = (
					<>
						{names.join(", ")}, and {last} are editing this file
					</>
				);
			}
		}
		return message;
	};

	const { modifiedByOthers, editingThisFile, hasConflict } = derivedState;

	if (!modifiedByOthers) return null;

	return (
		<Root className={cx({ "color-warning": hasConflict })}>
			{hasConflict && <Icon name="alert" />}
			{makeNameList(editingThisFile, hasConflict)}
		</Root>
	);
};
