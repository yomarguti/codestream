# Change Log

## [0.11.0] - 2018-09-11
### Added
- Initial beta release for the VS Code Marketplace.
- Adds support for emoji selection and auto-completion.
- Adds ability to add reactions to messages.
- Adds support for the use of markdown in messages.
- Adds display of CodeStream version number to bottom of sign-in page.

### Changed
- Stores credentials in native credential store if available for increased security.
- Bundles node_modules into extension for speed and reduced size.

### Fixed
- Fixed issue with new channel members not always seeing complete message history without reload of webview.