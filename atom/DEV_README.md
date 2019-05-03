## To get started

1. clone the repo and make sure it's a sibling to the `codestream-lsp-agent` and `codestream-components` repos
2. `cd` into the repo
3. run `apm install && apm link`

## To create a working build

1. from the repo root, run `npm run bundle`

## For development

1. install the prettier-atom package in atom
2. in the settings for prettier-atom, enable the following settings

- 'Format Files on Save'
- 'Only format if Prettier is found in your project's dependencies'

**Pro-tip** If you open atom in dev mode (`atom --dev path/to/project`), there will be additional
debugging functionality, which will be noted below. It's probably best to use the
`--dev` flag for a debugging window.

## NPM scripts

- `build`: builds both the extension and webview
- `watch`: watches both the extension and webview
- `extension:build`
- `extension:watch`
- `webview:build`
- `webview:watch`. webview changes don't require a reload of the debugging window. just kill and reopen the codestream view

**Pro-tip** `apm install teamcodestream/codestream-atom-toolbar` for a toolbar with buttons to easily change environments, reload the window, and signout
