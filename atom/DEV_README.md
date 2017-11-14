## To get started locally
1. clone the repo
2. `cd` into the repo
3. run `apm install && apm link`

## Connecting to server
If you want to use a local instance of the api server,
you'll need to use the dev_tools to create a sandbox for it.
Once you have your sandbox, set an environment variable:

`CS_API_IGNORE_HTTPS=true`

This is required for local development because chrome won't be happy about our self signed certificates and all requests from atom will be rejected.

Next, you'll need to tell the plugin where the server is by editing your atom configs. This can be done from atom or the command line.

### From Atom
1. Click on 'Atom' in the top left of the status bar
2. Select 'Config'
3. A new file should open

### From the CLI
1. Open `~/.atom/config.cson` wherever you choose

## In your Atom config file
CSON is like JSON just without the punctuation.
Add a new entry to the top under the '*' so it looks like

``` cson
*
  "codestream":
    url: "http://localhost:12079"
```

__Notice the protocol is 'http' because the api server has been configured to ignore ssl__
