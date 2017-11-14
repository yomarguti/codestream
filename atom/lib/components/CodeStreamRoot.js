import React, { Component } from "react"
import getSystemUser from "username"
import NoGit from "./NoGit"
import Onboarding from "./Onboarding"

export default class CodeStreamRoot extends Component {
	static defaultProps = {
		repositories: []
	}

	constructor(props) {
		super(props)
		this.state = {}
	}

	render() {
		const { repositories } = this.props

		if (repositories.length === 0) return <NoGit />
		else {
			const repository = repositories[0]
			const gitDirectory = repository.getWorkingDirectory()
			const email = repository.getConfigValue("user.email", gitDirectory)
			const name = repository.getConfigValue("user.name", gitDirectory)
			return <Onboarding email={email} username={getSystemUser.sync()} name={name} />
		}
	}
}
