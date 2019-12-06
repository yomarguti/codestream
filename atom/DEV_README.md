## To get started

1. clone the repo and make sure it's a sibling to the `codestream-lsp-agent` and `codestream-components` repos
2. Build [codestream-components](https://github.com/TeamCodeStream/codestream-components/blob/develop/README.md)
3. Build [codestream-lsp-agent](https://github.com/TeamCodeStream/codestream-lsp-agent/blob/develop/README.md)
4. `cd` into the repo
5. run `apm link`, which tells atom to use this directory as the package source

## Github access token

Because this repo uses an npm package hosted privately in our github, you'll need to ensure your GitHub acess token has rights to use our package registry.

If you're not sure it does or you want to create a new one:

1. Go to the [token settings](https://github.com/settings/tokens) in GitHub
2. Click 'Generate new token'
3. Name this token whatever you want
4. Check the boxes for `write:packages`, `read:packages`, and `delete:packages`. You can select anything else you want this token to support
5. Scroll to the bottom and click 'Generate token'
6. Copy the token
7. In your `~/.npmrc` file (create it if you don't have it), put this - `//npm.pkg.github.com/:_authToken=`, with your new token at the end

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
