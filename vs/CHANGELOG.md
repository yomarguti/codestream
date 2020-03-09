# Change Log

# [6.3.0] - 2020-3-10

### Added

- Adds the ability to create an issue not connected to a block of code via the + menu in the global nav

### Changed

- More robust Filter & Search tab with an improved UI, [advanced search syntax](https://github.com/TeamCodeStream/CodeStream/wiki/Filter-and-Search), and the ability to save custom filters
- More readable activity feed UI, with author/action separated out from each card

### Fixed

- Fixes an issue sharing to Slack when there are spaces in the remote URL

## [6.2.0] - 2020-2-19

### Added

- Adds the ability to share codemarks to Microsoft Teams

### Fixed

- Fixes an issue with access tokens expiring for the Jira integration

## [6.1.0] - 2020-2-3

### Added

- Adds the ability to create additional CodeStream teams from the ellipses menu in the top nav

### Changed

- The pull-request integrations will now display comments from open PRs if you are on either the source or destination branches

## [6.0.1] - 2020-1-27

### Fixed

- Fixes [#146](]https://github.com/TeamCodeStream/CodeStream/issues/146) &mdash; Unclear that duplicated shortcut label means keychord
- Fixes an issue that could lead to degraded IDE performance when CodeStream is opened with very large source files
- Fixes an issue where the compose menu in the CodeStream pane would not persist if you switched files while code was selected

## [6.0.0] - 2020-1-14

### Added

- Adds a new Activity Feed to notify you about new codemarks and new replies to codemarks
- Adds the ability for CodeStream teams to optionally share codemarks to Slack, without requiring broad access to your workspace
- Adds the ability to share any existing codemark, including those created by teammates, to Slack
- Adds the ability to reply to codemarks from Slack via a "View Discussion & Reply" button
- Adds the ability to specify a default sharing destination on Slack per repo (look for gear menu at top of the channel-selection dropdown)
- Adds new codemark-centric email notifications, which allow you to post replies by simply replying to the email
- Adds new notification settings under the ellipses menu in the top nav
- Adds the ability to manually follow/unfollow individual codemarks to control notifications
- Adds the ability to create a codemark via the "+" button in the top nav, where the code block is optional
- Adds a new Team tab to the top nav where you can invite teammates and see those already on the team
- Adds repo name to the display of codemarks

### Changed

- Assignment of an issue (excluding those shared externally) is now treated like a mention so that the assignee is notified

### Fixed

- Fixes [#139](]https://github.com/TeamCodeStream/CodeStream/issues/139) &mdash; GitHub PR comments not showing up

## [5.2.5] - 2019-12-20

### Fixed

- Fixes an issue with repo matching on startup

## [5.2.4] - 2019-12-19

### Added

- Adds a roadblock to let people know when CodeStream can't connect due to possible proxy issues

### Changed

- The form to create a codemark is now keyboard navigable

### Fixed

- Fixes an issue with creating codemarks that include blank line at the end of a file
- Fixes a broken link on the form to configure the GitLab Self-Managed integration

## [5.2.3] - 2019-11-27

### Added

- Adds support for self-signed SSL certificates for CodeStream On-Prem
- Adds display of CodeStream version number at the bottom of the ellipses menu

### Fixed

- Fixes an issue with very large codemarks not being displayed on Slack
- Fixes an issue with "Open on GitHub" buttons not accounting for .com-githubHandle remote syntax

## [5.2.2] - 2019-11-19

### Added

- Adds support for merge request comments from GitLab via the "PR" toggle on the Current File tab

### Changed

- When you cancel the creation of a codemark you are now prompted to confirm the action<
- By default, codemarks are now displayed as glyphs in the editor even when the Current File tab is selected

### Fixed

- Fixes an issue where the CodeStream entries in the lightbulb menu were duplicated
- Fixes an issue with the display of codemarks, as well as the codemark creation form, near the bottom of a file
- Fixes an issue where Slack DMs sometimes weren't available for sharing a codemark

## [5.2.0] - 2019-11-6

### Changed

- Repo matching logic now also includes commit hashes to better handle scenarios where teammates don't have a common remote URL for the same repo

### Fixed

- Fixes an issue where the codemark compose form and the newly-created codemark would briefly appear at the same time
- Fixes an issue where the current codemark was available for selection as a related codemark

## [5.1.0] - 2019-10-30

### Added

- Adds "Open in IDE", "Open on Web" and "Open on GitHub" (or Bitbucket/GitLab) links to issues created in external issue-tracking services (Jira, Trello, etc.)
- Adds the ability to manually reposition a codemark in cases where its location isn't automatically updated based on changes to the code

### Changed

- Changed the "Open on CodeStream" button in posts to Slack / MS Teams to "Open on Web"
- Improvements on codemark location calulation

### Fixed

- Fixes an issue with editing replies
- Fixes an issue with the dropdowns for Author and Branch on the Search tab not working
- Fixes an issue with the formatting of code blocks in issues created on YouTrack
- Fixes an issue where the "Open in IDE" button, for codemarks with multiple locations, would always open to the first location
- Fixes issues with "Open in IDE" from codemark pages in Firefox

## [5.0.1] - 2019-10-18

### Fixed

- Fixes an issue with codemarks disappearing after a commit

## [5.0.0] - 2019-10-16

### Added

- Add the ability to have multiple blocks of code, even across files/repos, associated with a single codemark
- Adds the ability to create issues on GitLab Enterprise

### Changed

- Codemarks can now be created and shared with your teammates even if you have unpushed commits
- Archived codemarks and resolved issues are now both controlled by the Archived filter on the Current File tab

### Fixed

- Fixes an issue where assignee wasn't being set correctly for issues created on GitLab
- Fixes an issue with the Asana integration where tasks weren't getting created

## [4.0.1] - 2019-10-2

### Added

- Adds the ability to filter codemarks on the Search tab by author, branch or commit

### Fixed

- Fixes an issue with changing issue-tracking services via the dropdown on the codemark form

## [4.0.0] - 2019-10-1

### Added

- Comments on merged-in pull requests from either GitHub or Bitbucket are now displayed right alongside the code blocks they refer to
- The ability to inject a codemark as an inline comment now has an option to include replies

### Fixed

- Fixes an issue where an issue codemark with a blank description would not get posted to Slack
- Fixes an issue where automated closed/opened messages for issue codemarks were not getting posted to Slack
- Fixes the sort order of Jira projects so that they are in alphabetical order
- Fixes an issue where the ability to star a reply was missing for Slack-connected teams
- Fixes an issue where Slack desktop notifications for codemarks would not include any content

## [3.0.1] - 2019-9-20

### Added

- Adds options to codemarks shared on Microsoft Teams to open a codemark on the web, in your IDE or, in the case of issues, on the issue-tracking service
- Adds new tophat to display of codemarks when the referenced code has been deleted

### Changed

- The bookmark codemark type has been removed, to be brought back at a future date

### Fixed

- Fixes [#117](]https://github.com/TeamCodeStream/CodeStream/issues/117) &mdash; Deleting codemark from Search tab causes unexpected error
- Fixes [#116](]https://github.com/TeamCodeStream/CodeStream/issues/116) &mdash; Creating codemark takes you out of List view
- Fixes [#115](]https://github.com/TeamCodeStream/CodeStream/issues/115) &mdash; Tab then enter discards codemark
- Fixes an issue with incorrect range being selected when code highlighted from the bottom up, and context menu used to create codemark
- Fixes an issue with permalinks being displayed on the Search tab

## [3.0.0] - 2019-9-17

### Added

- Adds a "Copy link" menu option for all codemarks so that they can be shared anywhere at any time
- Adds new web-based codemark pages to display codemarks shared via link
- Adds options to codemarks shared on Slack to open a codemark on the web, in your IDE or, in the case of issues, on the issue-tracking service
- When opening a codemark in your IDE from Slack or the web, if you don't happen to have the given repo open, CodeStream will still open the file for you automatically if you've ever opened that repo while signed into CodeStream. If not, we'll prompt you to open the repo, and we'll remember the location so you don't have to do that again.
- Adds a team switcher under the ellipses menu to switch between all of your CodeStream teams
- For on-prem installations, adds a check to make sure that the version of the API server running is compatible with the extension

### Fixed

- Fixes a rate limiting issue experienced by certain teams authenticating with Microsoft Teams
- Fixes an issue with deleting replies to a codemark
- Fixes an issue with syncing with YouTrack after authenticating
- Fixes an issue where a codemark created against unsaved code would not appear immediately

## [2.1.3] - 2019-9-10

### Fixed

- Fixes [#102](]https://github.com/TeamCodeStream/CodeStream/issues/102) &mdash; Unable to prevent auto-opening of the CodeStream pane

## [2.1.2] - 2019-9-9

### Added

- Addresses [#79](]https://github.com/TeamCodeStream/CodeStream/issues/79) &mdash; Adds branch info to codemark display when there's a diff
- Adds the ability to inject a codemark as an inline comment

### Fixed

- Fixes a rate limiting issue experienced by certain teams authenticating with Microsoft Teams
- Fixes an issue where replies to a codemark in a Slack-connected team would briefly appear twice
- Fixes an issue where there was no confirmation message when adding a user to a channel via slash command
- Fixes issues with support for Visual Studio 2019 16.3 Preview 2.0
- Fixes an issue with problems authenticating with Slack when adding real-time chat

## [2.1.1] - 2019-8-21

### Fixed

Activation issue on subsequent folder/solution opens

## [2.1.0] - 2019-8-20

### Added

- Adds Open Folder functionality
- Adds more robust tagging functionality, allowing you to create tags with any color / text label combination
- Adds the ability to link parts of your codebase by adding "related" codemarks to a parent codemark, and then using the links to jump around the codebases

### Changed

- Improved display of collapsed codemarks to make it easy to see tags, assignees, linked issues (i.e., on an external service like Jira), and the presence of replies or related codemarks
- All new cleaner display of expanded codemarks, with replies now displayed in descending order (i.e., most recent first)
- Consistent display of codemarks across all areas of CodeStream
- Smoother scrolling of codemarks in the CodeStream pane

### Fixed

- Fixes [#74](https://github.com/TeamCodeStream/CodeStream/issues/74) &mdash; Extension messes with default settings / LSP is changing the theme
- Fixes an issue with the positioning of the codemark form when creating a codemark at the bottom of the viewport
- Fixes an issue with not being able to change issue-tracking selection once Azure DevOps has been selected
- Fixes an issue with password reset in CodeStream on-prem

## [2.0.0] - 2019-8-1

### Added

- Adds issue-tracking integrations with Jira Server and GitHub Enterprise

### Changed

- Updates the UI for creating issues on external issue tracking services to allow you to be connected to multiple services at once and change the selection on an issue by issue basis
- Codemarks now appear immediately upon submission
- Trailing slashes are stripped off of the Server URL setting for on-prem installations

### Fixed

- Fixes an issue with not all DMs from Slack appearing in the conversation selector when creating a codemark
- Fixes an issue with a lack of notification when viewing a codemark in a file you don't have

## [1.3.4] - 2019-7-26

### Added

- Adds roadblocks when your extension is behind either a required or suggested version of CodeStream

### Fixed

- Fixes [#71](]https://github.com/TeamCodeStream/CodeStream/issues/71) &mdash; You can edit channel selection when editing via thread view

## [1.3.3] - 2019-7-17

### Fixed

- Fixes an issue where clicking on a codemrk from the Search tab or a stream would not open the corresponding source file

## [1.3.2] - 2019-7-16

### Changed

- Added a "Back" link below the password-reset form in case you change your mind

### Fixed

- Fixes [#70](]https://github.com/TeamCodeStream/CodeStream/issues/70) &mdash; Once joined more than one channel, I can't choose into which channel a comment should go to anymore
- Fixes an issue with repos managed by Bitbucket Server incorrectly being identified as being managed by Bitbucket cloud
- Fixes scrolling issues when creating and viewing longer codemarks

## [1.3.1] - 2019-7-10

### Added

- Password reset. Sorry it took so long!
- Enforcement of CodeStream's 30-day free trial, and 5-member limit for teams on the free plan

### Changed

- Optimizations to ipc between our processes and plugin startup

### Fixed

- Fixes an issue where scrolling in the CodeStream pane with the compose modal open would lose any information already entered
- Fixes an issue where a codemark could get posted as a reply to another codemark if you had thread view open
- Fixes a spacing issue on the Sign In page
- Fixes an issue with new UI not being applied to email confirmation and Team Name pages
- Fixes rendering issues with certain Slack bots when using Slack real-time channels

## [1.3.0] - 2019-6-26

### Added

- New Microsoft Teams integration allows you to share codemarks in your organization's existing channels. [Learn more.](https://www.codestream.com/blog/codestream-1-3)
- New Slack integration that reduces the amount of Slack that appears in CodeStream, with the full Channels tab now being optional

### Changed

- Updated the UI of CodeStream's signup flow
- Asana projects are now listed in alphabetical order for selection

### Fixed

- Fixes an issue where adding new lines in your editor exhibited poor performance
- Fixes an issue with code blocks in Trello cards not rendering properly, and not including the line numbers

## [1.2.0] - 2019-6-14

### Changed

- The Invite People page now only shows teammates from your Slack workspace that have signed up for CodeStream

### Fixed

- Fixes an issue that would cause an error when opening a Slack channel with Japanese characters in the name
- Fixes an issue where hovering over an expanded codemark wouldn't highlight the corresponding code block in the editor
- Fixes an issue with text in backticks not rendering properly
- Fixes an issue with new lines being displayed as html in posts on Slack
- Fixes an issue with new lines in codemark text causing display issues on the Search tab
- Fixes an issue with the Asana integration that was preventing projects from being listed
- Fixes an issue with invitation codes incorrectly expiring after 10 minutes
- Fixes an issue with editing a reply from a codemark's thread view

## [1.1.0] - 2019-6-4

### Changed

- Signup flow is now based in the IDE instead of on the web
- For CodeStream teams, invitations are now code-based allowing for quicker signup
- For Slack teams, invitation URLs have been simplified
- Clicking on a codemark in the editor gutter opens the codemark in the Current File tab in CodeStream

### Fixed

- Fixes [#60](]https://github.com/TeamCodeStream/CodeStream/issues/60) &mdash; can't delete codemark in vscode
- Fixes [#57](https://github.com/TeamCodeStream/CodeStream/issues/57) &mdash; Cygwin git support
- Fixes an issue with bookmark titles not being displayed on Slack
- Fixes an issue with code snippets added to a codemark via markdown not rendering
- Fixes an issue with CodeStream impacting typing performance in the editor

## [1.0.2] - 2019-5-22

### Fixed

- Fixes an issue that would cause an alert box to appear on Visual Studio load
- Fixes an issue where a new codemark sometimes wouldn't appear right away
- Fixes an issue where git repos with remote URLs containing port numbers would prevent codemarks from being displayed properly
- Fixes [#61](https://github.com/TeamCodeStream/CodeStream/issues/61) &mdash; Formatting issues with codemarks

## [1.0.1] - 2019-5-15

### Added

- Adds an integration with YouTrack issue tracking

## [1.0.0] - 2019-5-13

### Added

- Adds preemptive warnings about creating codemarks in files that aren't managed by Git, don't have remote URLs, or haven't been saved

### Fixed

- Fixes an issue with the wrapping of filename and line number information in the codemark form

## [0.53.0] - 2019-5-3

### Added

- CodeStream now integrates with Azure DevOps issue tracking

### Changed

- Improved startup performance and reliability
- CodeStream options are now grouped under a sub-menu in the editor context menu
- Improved performance in editor window when the Current File tab in CodeStream is selected
- When editing an issue codemark linked to an external service, assignees are read-only since they can't be edited from CodeStream

### Fixed

- Fixes an issue where archived codemarks were appearing in the gutter and scrollbar
- Fixes an issue where a codelens would be included when highlighting code on hover over a codemark
- Fixes an issue with button backgrounds missing in light mode
- Fixes an issue where codemarks would not be reflected in the editor scrollbar until the window was re-focused
- Fixes an issue with mentions posted in a reply not being treated as a mention in terms of badges and notifications
- Fixes an issue where CodeStream would not recognize when a source file wasn't selected or open
- Fixes an issue when changing the code selection with the codemark form already open
- Fixes an issue with editing posts from the conversation stream

## [0.52.1] - 2019-4-19

### Added

- Adds a guide to keyboard shortcuts in the default view of the Current File tab when there are no codemarks

### Changed

- Updated the Jira integration to accommodate the GDPR-related changes to the Jira Cloud REST APIs, which means that Jira assignees can no longer be mapped to a CodeStream user

### Fixed

- Fixes an issue that prevented users without Git installed from being able to sign in
- Fixes an issue that prevented the editing of replies
- Fixes an issue where the "Open in..." link in issue codemarks wouldn't work
- Fixes an issue where the Current File tab would not immediately recognize a newly opened source file
- Fixes an issue with the Current File tab not behaving properly with split windows or peek windows
- Fixes an issue with VS tool windows being recognized as source files

## [0.52.0] - 2019-4-11

### Added

- Adds a completely new view of codemarks that makes information much more accessible, with the ability to view and edit in-place. [Read more on our blog.](https://blog.codestream.com/index.php/2019/04/10/codestream-v0-52-new-codemarks-view/)
- Adds the ability to "star" a reply so that it's surfaced in the codemarks view
- Adds the ability to assign shortcuts to individual codemarks, allowing you to quickly jump around the codebase
- Adds a toolbar to the bottom of the Current File tab with filters to control whether or not you see completed issues or archived codemarks
- Adds clickable indicators to the toolbar to let you know when there are codemarks above/below your current view
- Archived codemarks and resolved issues are now displayed in a collapsed format in a new gutter at the right side of the CodeStream pane, with the ability to click to expand the display
- Adds a new header treatment for archived codemarks
- Scrolling the view of codemarks in the CodeStream pane will now scroll the source file as well
- Adds a quick overview of codemarks accessible via an info icon at the bottom-right of each codemark

### Changed

- The display of an expanded codemark only includes the code block, as well as the Compare and Apply links, if there’s a diff from what you have locally

### Fixed

- Fixes an issue where using the “selected conversations” filter on the Channels tab, with only a single channel selected, would cause codemarks to get shared to the wrong conversation
- Fixes an issue where a codemark would no longer render on CodeStream if the post was deleted via the Slack client
- Fixes an issue where archived and closed Slack conversations were appearing in the conversation selector when creating a codemark
- Fixes an issue that prevented an edited bookmark from being saved

## [0.51.1] - 2019-4-4

### Fixed

- Fixes a race condition in the extension that may result in an alert box when Visual Studio starts
- Fixes an issue with the Live Share integration not working under VS 2019

## [0.51.0] - 2019-4-2

### Changed

- Changes the `Ctrl+/` `Ctrl+/` shortcut to toggle the CodeStream pane
- Improves the Jira project search to ensure all projects are available for selection

### Fixed

- Fixes [#42](https://github.com/TeamCodeStream/CodeStream/issues/42) &mdash; VS Slack black text
- Fixes an issue with CodeStream causing laggy typing

## [0.50.0] - 2019-3-21

### Added

- Adds a Google Docs-like display of codemarks in the current file, where codemarks are displayed to the right of the source code and scroll up/down along with the source
- Adds a permalink codemark type for sharing a link to a specific block of code
- Adds the ability to close or re-open an issue from the codemark's thread view
- Adds an Archive option to a codemark’s gear menu to hide it when the Current File tab is selected (but it will still be shown on the Search tab)
- Adds [keyboard shortcuts](https://github.com/TeamCodeStream/CodeStream/wiki/Keyboard-Shortcuts) for creating a codemark after selecting some code
- Adds annotations to the editor scroll bar to indicate where codemarks exist in the source file

### Changed

- Opening the CodeStream pane is now much faster
- New icon-based global navigation
- When selecting a channel/DM to share a codemark, the list now honors the “selected conversations” filter from the Channels tab
- Context/lightbulb menus in the editor now have separate entries for creating a comment, issue, bookmark or permalink

### Fixed

- Fixes [#37](https://github.com/TeamCodeStream/CodeStream/issues/37) &mdash; Need to log in CodeStream on VS each time the computer is shutdown
- Fixes an issue with the wrong channel name being displayed at the top of the page when viewing a codemark
- Fixes an issue with links to join a Live Share session not being clickable
- Fixes an issue with “/cc” being include in codemarks shared on Slack when no one was mentioned

## [0.11.0] - 2019-02-15

### Added

- Adds support for network connections via proxies

### Fixed

- Fixes an issue with codemarks occasionally appearing on the wrong line
- Fixes an issue where CodeStream would incorrectly reload immediately after login
- Fixes an issue where the Submit/Cancel buttons would not render correctly when creating a codemark
