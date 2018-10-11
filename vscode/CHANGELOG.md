# Change Log

## [0.15.1] - 2018-10-11

## Fixed

- Fixes [#5](https://github.com/TeamCodeStream/CodeStream/issues/3) &mdash; Clicking Slack emoji icon produces an unexpected error

## [0.15.0] - 2018-10-10

### Added

- Adds the ability to access all of your Slack channels and DMs from within CodeStream. [Learn more.](https://blog.codestream.com/index.php/2018/10/10/codestream-brings-slack-into-vs-code/)

## Fixed

- Fixes possible incorrect team selection when signing into a Slack team
- Fixes missing slack thread replies from showing up in the channel

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
