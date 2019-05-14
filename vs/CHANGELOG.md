# Change Log

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
