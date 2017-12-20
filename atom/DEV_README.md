## To get started locally

1. clone the repo
2. `cd` into the repo
3. run `apm install && apm link`
4. install the prettier-atom package in atom
5. in the settings for prettier-atom, enable the following settings

* 'Format Files on Save'
* 'Only format if Prettier is found in your project's dependencies'
* 'Only format if a Prettier config is found'

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

Now you can start the api server. Next, you'll need to tell the plugin where the server is by
editing your atom configs. This can be done from atom or the command line.

### From Atom

1. Click on 'Atom' in the top left of the status bar
2. Select 'Config'
3. A new file should open

### From the CLI

1. Open `~/.atom/config.cson` wherever you choose

## In your Atom config file

CSON is like JSON just without the punctuation. Add a new entry to the top under the '\*' so it
looks like

```cson
*
  "codestream":
    url: "https://localhost.codestream.us:12079"
```

## Other Environments you can point to

Dev server - https://tca3.codestream.us:9443

## Resetting the database(s)

At some point, you'll want to reset everything. The plugin keeps data cached in indexeddb so if you
wipe everything in mongo, you probably should clear indexeddb too.

You can use Mongo's app, [Compass](https://www.mongodb.com/products/compass), for interacting with
databases.

To clear what's in the client cache, open atom's command palette and run the `Codestream: Wipe
Cache` command.

If you want to logout and create a new session, from the command palette run `Codestream: Logout`.

## Redux DevTools

Visualizing the UI state is really helpful when trying to debug and see how the data changes. This
is where the Redux DevTools chrome extension comes in. Since atom runs on electron, which is sort of
an instance of chrome, it has support for some chrome extensions that are for the developer console.

To install the Redux DevTools, follow the steps
[here](https://github.com/electron/electron/blob/master/docs/tutorial/devtools-extension.md#how-to-load-a-devtools-extension).
**Note:** in those instructions, there's a reference to the `BrowserWindow` object. It can be
accessed with `require('electron').remote.BrowserWindow`.
