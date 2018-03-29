import React from "react";
import InviteTeamMembersForm from "./InviteTeamMembersForm";

const views = {
	invite: InviteTeamMembersForm
};

export default ({ page }) => React.createElement(views[page]);
