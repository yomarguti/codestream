# Change Log

## [0.32.0] - 2019-1-7

### Fixed

- Fixes an issue with unread message indicators not clearing for CodeStream teams when there were unreads in multiple channels

## [0.31.0] - 2018-12-20

### Changed

- Replies posted to a thread are no longer broadcast to the channel on Slack to temporarily work around a Slack bug
- Link text when hovering over a codemark in a source file is now based on the type of codemark

### Fixed

- Fixes an issue where very long strings would expand the New Codemark modal off the page
- Fixes an issue with the help text in the chat box when viewing a thread
- Fixes an issue with line breaks not being preserved in codemark descriptions
- Fixes an issue with the Codemarks tab not taking repo into account when associating codemarks with the current file
- Fixes an issue with the webview not always restoring the previously selected channel


## [0.30.3] - 2018-12-12

### Fixed

- Fixes [#28](https://github.com/TeamCodeStream/CodeStream/issues/28) &mdash; Certain markdown snippets cause markdown parsing library to throw an error

## [0.30.2] - 2018-12-10

### Fixed

- Fixes [#20](https://github.com/TeamCodeStream/CodeStream/issues/20) &mdash; Add CodeStream comment doesn't work for Slack
- Fixes an issue with automated messages for the closing of an issue codemark not being displayed as part of the issue's thread.

## [0.30.1] - 2018-12-6

### Fixed

- Fixes an issue where if another user created a codemark (without code), it would not immediately be displayed in the Codemarks view
- Fixes an issue where if another user created a codemark (with code), it would not be displayed in the editor until a reload

## [0.30] - 2018-12-6

### Added

- Adds different types of "codemarks", including comments, issues, code traps and bookmarks, for annotating your code base - [Learn more about codemarks](https://github.com/TeamCodeStream/CodeStream/wiki/Building-a-Knowledge-Base-with-Codemarks)
- Adds a "Codemarks" page for exploring your knowledge base and looking at filtered views of your codemarks
- Adds a global navigation with tabs for jumping between codemarks, channels and your currently selected conversation
- Adds the ability to search for codemarks
- Adds a form for creating codemarks that automatically pops up when code is selected in your editor
- Adds a "Quote" option to the gear menu for posts in the stream to easily quote a post
- Adds the ability to start a Live Share session via an icon that appears on hover on the Channels tab

### Changed

- Continued (but significant) optimizations for handling large slack workspaces

### Fixed

- Fixes [#10](https://github.com/TeamCodeStream/CodeStream/issues/10) &mdash; Downloading Channel list takes a very long time, then fails
- Fixes [#15](https://github.com/TeamCodeStream/CodeStream/issues/15) &mdash; Unable to open channels with Japanese characters
- Fixes [#17](https://github.com/TeamCodeStream/CodeStream/issues/17) &mdash; Links to Github don't put hash in URL properly
- Fixes [#18](https://github.com/TeamCodeStream/CodeStream/issues/18) &mdash; Unread count in VS Code status bar not decrementing

## [0.24.2] - 2018-11-19

### Fixed

- Fixes issue with some slack teams missing real-time events -- affected teams will be signed out and will need to reauthenticate to resolve the issue

## [0.24.1] - 2018-11-16

### Fixed

- Fixes some performance issues with larger Slack teams (still a work-in-progress)

## [0.24.0] - 2018-11-12

### Added

- Adds an Open button to incoming message notifications to jump directly to the channel &mdash; closes [#8](https://github.com/TeamCodeStream/CodeStream/issues/8)

### Changed

- Improves reconnection status and behavior on network connection loss or sleep for Slack teams

### Fixed

- Fixes an issue where unread indicators were not showing up on channels after logging in with Slack teams
- Fixes an issue where unread indicators were sometimes showing up for archived channels with Slack teams
- Fixes an issue where in certain (rare) cases the agent process could get stuck in an infinite loop

## [0.23.0] - 2018-11-9

### Changed

- Improves performance of initial loading of channels/DMs for Slack teams

## [0.22.1] - 2018-11-7

### Fixed

- Fixes an undefined property error while calculating count of unread messages

## [0.22.0] - 2018-11-2

### Fixed

- Fixes an issue with logging into some Slack teams
- Fixes issues with reconnecting to Slack after a network connection loss
- Fixes an issue where channels deleted from Slack wouldn't get removed from CodeStream

## [0.21.0] - 2018-11-1

### Added

- Adds support for network connections via proxies
- Adds the ability to add people to or remove people from a Slack channel via CodeStream
- Adds the synchronization of a channel's muted status from Slack

### Changed

- Prioritize Slack DMs to reduce the number that need to be loaded

### Fixed

- Fixes an issue with leaving a Slack channel from within CodeStream
- Fixes an issue with adding people while creating a Slack channel from CodeStream
- Fixes an issue where creating a Slack DM could result in an unexpected error
- Fixes an issue with marking a stream as read
- Fixes [#12](https://github.com/TeamCodeStream/CodeStream/issues/12) &mdash; Webview: FAILED waiting for webview ready event
- Fixes an issue with CodeStream's ephemeral system posts sometimes causing errors

## [0.20.0] - 2018-10-29

### Added

- Adds the display of Slack-based presence next to DMs on the channel switcher
- Adds the synchronization of closed DMs between Slack and CodeStream

### Changed

- Optimizes startup performance to avoid rate-limiting and slow foreground requests due to background fetching when using Slack channels

## [0.19.0] - 2018-10-26

### Added

- Adds ability to archive a Slack channel via the /archive slash command
- Adds ability to rename a Slack channel via the /rename slash command
- Adds ability to set the purpose of a Slack channel via the /purpose slash command
- Adds /msg command for Slack channels

### Changed

- Reduced our default post fetch count to 50 for better performance

### Fixed

- Fixes an issue with the /msg slash command adding extra spaces in the message
- Fixes an issue with seeing replies in some case with CodeStream channels
- Fixes issues where in certain cases marker recalculation failed

## [0.18.0] - 2018-10-24

### Changed

- Decouple the loading of Slack channels from the loading of unread and latest-post information.

### Fixed

- Fixes an issue with new direct messages not appearing on the channel switcher without a reload.
- Fixes an issue with deactivated users appearing in list of DMs and in list of current team members.
- Fixes an issue where code block wasn't being highlighted in source file when entering thread view.
- Fixes an issue that prevented the deletion of multiple posts.
- Fixes an issue with adding and removing people from CodeStream channels.
- Fixes an issue with renaming or setting the purpose of a CodeStream channel.
- Fixes an issue with being able to react to a message multiple times with the same emoji.

## [0.17.1] - 2018-10-17

### Fixed

- Fixes an issue with markers not working

## [0.17.0] - 2018-10-17

### Fixed

- Fixes [#6](https://github.com/TeamCodeStream/CodeStream/issues/6) &mdash; Github Links in Slack messages are broken
- Fixes an unexpected error when creating a new direct messages
- Fixes an issue that would incorrectly redisplay the "unread messages above" banner
- Fixes an issue that prevented the display of the new-message separator in the stream

## [0.16.0] - 2018-10-15

### Fixed

- Fixes syncronization of unread message indicators between CodeStream and Slack.
- Fixes issues with certain message content that would trigger unexpected errors.

## [0.15.1] - 2018-10-11

### Fixed

- Fixes [#5](https://github.com/TeamCodeStream/CodeStream/issues/3) &mdash; Clicking Slack emoji icon produces an unexpected error

## [0.15.0] - 2018-10-10

### Added

- Adds the ability to access all of your Slack channels and DMs from within CodeStream. [Learn more.](https://blog.codestream.com/index.php/2018/10/10/codestream-brings-slack-into-vs-code/)

## Fixed

- Fixes possible incorrect team selection when signing into a Slack team
- Fixes missing Slack thread replies from showing up in the channel

## [0.13.0] - 2018-09-27

### Added

- Adds display of channel purpose in tooltip when you hover over channel name in stream header.
- Adds Back button to the header of the New Channel page.
- Adds emoji name to the tooltip when you hover over a reaction.

### Changed

- Changes UI of the channel switcher to more closely mirror the VS Code sidebar.
- Changes `codestream.showInStatusBar` setting to allow CodeStream to be shown at either the left or right side of the status bar.

## Fixed

- Fixes [#3](https://github.com/TeamCodeStream/CodeStream/issues/3) &mdash; Logging to debug console when debugging different extension

## [0.12.0] - 2018-09-19

### Added

- Adds a new `codestream.showInStatusBar` setting to specify whether to show CodeStream in the status bar &mdash; closes [#1](https://github.com/TeamCodeStream/CodeStream/issues/1)

## [0.11.0] - 2018-09-11

### Added

- Initial beta release for the VS Code Marketplace.
- Adds support for emoji selection and auto-completion.
- Adds ability to add reactions to messages.
- Adds support for the use of markdown in messages.
- Adds display of CodeStream version number to bottom of sign-in page.

### Changed

- Increases security by storing credentials in the native credential store if available.
- Reduces package size and improves loading performance.
- Notifies users of required extension updates, but otherwise now lets VS Code handle regular updates.

### Fixed

- Fixes issue with new channel members not always seeing complete message history without reload of webview.
