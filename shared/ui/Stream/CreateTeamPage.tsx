import React from "react";
import styled from "styled-components";
import { TextInput } from "../Authentication/TextInput";
import { Button } from "../src/components/Button";
import { FormattedMessage } from "react-intl";
import { InlineMenu } from "../src/components/controls/InlineMenu";
import { CodeStreamState } from "../store";
import { useSelector, useDispatch } from "react-redux";
import { createTeam } from "../store/teams/actions";
import { switchToTeam } from "../store/session/actions";
import { CSTeam } from "@codestream/protocols/api";
import { CreateTeamRequest } from "@codestream/protocols/agent";

const Header = styled.h3`
	text-align: center;
`;

export function CreateTeamPage() {
	const dispatch = useDispatch();
	const [teamName, setTeamName] = React.useState("");
	const [teamNameValidity, setTeamNameValidity] = React.useState(true);
	const [companyName, setCompanyName] = React.useState("");
	const [companyNameValidity, setCompanyNameValidity] = React.useState(true);
	const { companiesById, currentCompanyId, teams } = useSelector((state: CodeStreamState) => {
		return {
			companiesById: state.companies,
			currentCompanyId: state.teams[state.context.currentTeamId].companyId,
			teams: state.teams
		};
	});

	const [isLoading, setIsLoading] = React.useState(false);

	const [selectedCompanyId, setSelectedCompanyId] = React.useState<string | void>(currentCompanyId);

	const isTeamNameUnique = (name: string) => {
		return !Object.values(teams).some(team => team.name.toLowerCase() === name.toLowerCase());
	};

	const isTeamNameValid = (name: string) => {
		return name.length > 0 && isTeamNameUnique(name);
	};

	const onValidityChanged = (field: string, validity: boolean) =>
		field === "team" ? setTeamNameValidity(validity) : setCompanyNameValidity(validity);

	const validateTeamName = (name: string) => {
		const valid = isTeamNameValid(name);
		setTeamNameValidity(valid);
		return valid;
	};
	const validateOrgName = (name: string) => {
		const valid = isTeamNameValid(name);
		setCompanyNameValidity(valid);
		return valid;
	};

	const orgMenuItems = React.useMemo(() => {
		return [
			...Object.values(companiesById).map(company => ({
				key: company.id,
				label: company.name,
				action: () => setSelectedCompanyId(company.id)
			})),
			{ label: "-" },
			{
				key: "new-org",
				label: "New Organization",
				action: () => {
					setSelectedCompanyId();
				}
			}
		];
	}, [companiesById]);

	const onSubmit: React.FormEventHandler = async e => {
		e.preventDefault();
		if (!validateTeamName(teamName)) return;
		if (selectedCompanyId == undefined && !validateOrgName(companyName)) return;

		setIsLoading(true);

		try {
			let request: CreateTeamRequest;

			if (selectedCompanyId == undefined) {
				request = { name: teamName, company: { name: companyName } };
			} else {
				request = { name: teamName, companyId: selectedCompanyId };
			}

			const team = ((await dispatch(createTeam(request))) as unknown) as CSTeam;
			await dispatch(switchToTeam(team.id));
		} catch (error) {
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div>
			<Header>Create a Team</Header>
			<form className="standard-form" onSubmit={onSubmit}>
				<fieldset className="form-body">
					<div id="controls">
						<div className="control-group">
							<label>
								<FormattedMessage id="createTeam.name.label" />
							</label>
							<TextInput
								name="team"
								value={teamName}
								onChange={setTeamName}
								validate={isTeamNameValid}
								onValidityChanged={onValidityChanged}
								required
							/>
							{!teamNameValidity && (
								<small className="explainer error-message">
									{teamName.length === 0
										? "Required"
										: !isTeamNameUnique(teamName) && "Name already in use"}
								</small>
							)}
						</div>
						<br />
						<div id="controls">
							<div className="control-group">
								<label>
									Organization:{" "}
									<InlineMenu
										items={orgMenuItems}
										title="Your Organizations"
										value={
											selectedCompanyId != undefined
												? companiesById[selectedCompanyId].name
												: "New Organization"
										}
									/>
								</label>
								{selectedCompanyId == undefined && (
									<>
										<TextInput
											name="company"
											value={companyName}
											onChange={setCompanyName}
											validate={isTeamNameValid}
											onValidityChanged={onValidityChanged}
											required
										/>
										{!companyNameValidity && (
											<small className="explainer error-message">Required</small>
										)}
									</>
								)}
							</div>
						</div>
						<div className="button-group">
							<Button variant="primary" isLoading={isLoading}>
								<FormattedMessage id="createTeam.submitButton" />
							</Button>
						</div>
					</div>
				</fieldset>
			</form>
		</div>
	);
}
