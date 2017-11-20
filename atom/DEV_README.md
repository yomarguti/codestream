## To get started locally
1. clone the repo
2. `cd` into the repo
3. run `apm install && apm link`
4. install the prettier-atom package in atom
5. in the settings for prettier-atom, enable the following settings
  - 'Format Files on Save'
  - 'Only format if Prettier is found in your project's dependencies'
  - 'Only format if a Prettier config is found'

## Connecting to server
If you want to use a local instance of the api server,
you'll need to use the dev_tools to create a sandbox for it.
Once you have your sandbox, set an environment variable:

`export CS_API_IGNORE_HTTPS=true`

This is required for local development because chrome won't be happy about our self signed certificates and all requests from atom will be rejected.

By default in development, the api server will automatically confirm new accounts and in the plugin,
when you sign up and see the confirmation form, you can enter any code and you'll just be forwarded to log in form.
If you want to enable the confirmation code email and turn on the confirmation step, set the following variables in your shell.

``` bash
export CS_API_EMAIL_TO=#put your email here
export CS_API_CONFIRMATION_REQUIRE=1
```

Now you can start the api server. Next, you'll need to tell the plugin where the server is by editing your atom configs. This can be done from atom or the command line.

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

In order to get through onboarding right now,
you need to sign up, confirm your account, reload,
skip to sign in, sign in with your credentials,
and then you'll be shown the current stream interface, which is not hooked up to anything yet.
