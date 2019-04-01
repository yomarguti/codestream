## To get started

1. clone the repo and make sure it's a sibling to the `codestream-lsp-agent` and `codestream-components` repos
2. `cd` into the repo
3. run `apm install && apm link`

## To create a working build for using

1. from the repo root, run `npm run bundle`

## For development

3. install the prettier-atom package in atom
4. in the settings for prettier-atom, enable the following settings

- 'Format Files on Save'
- 'Only format if Prettier is found in your project's dependencies'

**Pro-tip** If you open atom in dev mode (`atom --dev path/to/project`), there will be additional
debugging functionality, which will be noted below. It's probably best to default to using the
`--dev` flag while working locally.

<!--
## Connecting to server

If you want to use a local instance of the api server, you'll need to use the dev_tools to create a
sandbox for it.

If you want to disable the confirmation code email and turn off the confirmation step, set the
following variables in your shell.

```bash
export CS_API_CONFIRMATION_NOT_REQUIRED=1
```

otherwise to get emails sent to your email address for local development, set:

```bash
export CS_API_EMAIL_TO=#your email here
```

Now you can start the api server. Next, you'll need to tell the plugin where the server is. Make sure to open the repository you want to use in atom's dev mode with the `--dev` flag from the command line or through the header menu at `View > Developer > Open In Dev Mode`.
 -->
