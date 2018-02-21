# CodeStream

CodeStream puts team chat into Atom (and other IDEs) so that developers can discuss code where they code. Conversation threads automatically become annotations that live with the codebase forever, so your codebase gets smarter over time.

**NOTE:** CodeStream is currently in beta. Visit [codestream.com](https://www.codestream.com) to learn more.

![FullIDE](https://codestream.zendesk.com/hc/article_attachments/360000712271/CodeStream.png)

# Installation

Make sure you have the atom shell commands installed. From the Atom command palette, run `Window: Install Shell Commands`. Then from the command line, type:

`apm install codestream`

Once installed, reload Atom. You can then toggle the CodeStream view via the Packages menu, or hit Cmd + Opt + O (Mac) / Ctrl + Alt + O (Windows). You can also click on the CodeStream logo that now appears in Atom’s statusbar.

If there are issues installing the plugin dependencies:

**OSX Users**

* Run `sudo xcode-select --install`
* `cd ~/.atom/packages/codestream`
* `apm install`
* Reload Atom.
* If there are still issues, you'll need to install libgcrypt. This can be done with homebrew via `brew install libgcrypt` or you by means of another package manager. Once installed, re-run `apm install`.

**Linux Users**

* You need `libssl-dev`. On ubuntu, you can use `sudo apt install libssl-dev`.
* `cd ~/.atom/packages/codestream`
* `apm install`
* Reload Atom.

# Requirements

* CodeStream requires a current version of **[Atom](https://atom.io/)**.
* Your repository must be managed by Git, or a Git hosting service like GitHub.
* Forking workflows aren’t currently supported.
* Make sure that you have just a single repository open in any one Atom window. Support for multiple repos is coming soon.
* Make sure you open an actual repository, and not a directory containing repositories.

# Things to Try

* Select a file in your source tree and you’ll see a chat stream in a new pane on the right. In fact, each source file has its own contextual chat stream.

* To talk about a specific block of code, just select the code in your buffer and then click on the “+” button that appears.

![PostCodeBlock](https://codestream.zendesk.com/hc/article_attachments/360000889751/PlusButton.png)

* Click on any post in the chat stream to add a reply. If the post included a code block, you’ll automatically be scrolled to the appropriate location in the source file. If the code block doesn’t match what you have in your buffer, you’ll have options to view a diff or even apply the changes to your buffer.

![ThreadView](https://codestream.zendesk.com/hc/article_attachments/360000885912/Screen_Shot_2018-02-08_at_4.59.26_PM.png)

* When you post a message, everyone on your team will see an indicator of new messages appear next to the appropriate file in their source tree. The badge will be blue if you were mentioned in a post.

![UMIs](https://codestream.zendesk.com/hc/article_attachments/360000890011/Badge.png)

* If you see a marker on the border of your source file and the chat pane, that means that a discussion took place about that block of code. Click on the marker to view the discussion.

![Markers](https://codestream.zendesk.com/hc/article_attachments/360000889931/Marker.png)

# Help

Check out our [help site](https://help.codestream.com) for more information on getting started with CodeStream.
