# CodeStream

CodeStream puts team chat into Atom (and other IDEs) so that developers can discuss code where they code. Conversation threads automatically become annotations that live with the codebase forever, so your codebase gets smarter over time.

![FullIDE](https://codestream.zendesk.com/hc/article_attachments/360000712271/CodeStream.png)

# Beta

CodeStream is currently in beta. The core messaging functionality, which is the heart of the service, is there and ready for you to use. Some other components of the service are still in the works.

* Your primary interaction with CodeStream is in the IDE, but there will also be a web component to the service that will include settings, profile and administration. All of that is in the works.
* Since we don’t have settings yet, you won’t have control over your email notifications. You can read our [guide to CodeStream notifications](https://help.codestream.com/hc/en-us/articles/360000327691-Guide-to-CodeStream-notifications), but the key thing is that if you want to turn emails off, just get in touch with us and we’ll take care of it for you.
* Similarly, you don't yet have the ability to upload a headshot. For now, if you have a [Gravatar](https://en.gravatar.com/) we’ll pull that in, otherwise we just create a default headshot for you using your initials.

# Requirements

* CodeStream requires a current version of **[Atom](https://atom.io/)**.
* Your repository must be managed by Git, or a Git hosting service like GitHub.
* Windows users need to have `git` available in their PATH.
* Make sure that you have just a single repository open in any one Atom window. Support for multiple repositories is coming soon.
* Make sure you open an actual repository, and not a directory containing repositories.

# Installation

To install CodeStream, visit Atom settings, click on the "Install" tab in the left rail, and then search for 'codestream'. When you find it in the results, click the 'Install' button.

Once installed, you can toggle the CodeStream view via the Packages menu, or hit Cmd + Opt + O (Mac) / Ctrl + Alt + O (Windows). You can also click on the chat bubbles icon that now appears in the status bar at the bottom of the Atom window.

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

* Head off problems before they even happen by looking out for the banners that indicate when another developer is editing the file you're looking at. Or if you both start to edit the file, we'll let you know there's a possibility of a merge conflict.

![MergeConflict](https://help.codestream.com/hc/article_attachments/360001973651/Banner_MergeConflict.png)

# Frequently Asked Questions

#### Where are messages stored?

Your team’s message history is stored in the cloud on CodeStream’s servers. Note that CodeStream does not store a copy of your source files. When a message includes a code block, a copy of that block is also stored in the cloud, but not the entirety of the source file.

All of your team's messages are also stored locally on your computer, meaning that you'll even have access to the message history when you're offline.

#### Who has access to my repo?

In addition to people that you explicitly add to your team on CodeStream, anyone with access to the codebase may join the team on their own. To do so, they will need to sign into CodeStream with the given repository (as identified by the URL of the origin and the hash of the first commit ID) open in their IDE.

#### Does it work across branches?

On CodeStream, chat streams are associated with source files, and not with commits. This allows developers to easily leverage past discussions to get a better understanding of how the file evolved over time and why specific changes were made. A new developer inheriting one of your files a year from now will never go back and reference past commits or pull requests, but on CodeStream they’ll see both the entirety of the chat stream associated with the file as well as markers in the code indicating where discussions took place.

CodeStream recognizes that developers on your team may be working on different branches, or may simply have local changes, that result in certain blocks of code being in different locations for each of them. If there are messages associated with those blocks of code, CodeStream ensures that each developer sees them in the correct location despite the variations in each of their local buffers.

#### What access to Git does CodeStream require?

You won’t need to provide CodeStream with any Git (or GitHub, Bitbucket, etc.) credentials, as the plugin simply leverages your IDE’s access to Git. CodeStream uses Git to do things like automatically mention the most recent author when you share a block of code in a post, and to maintain the connection between that block of code and where it’s located in the source file as the file evolves over time (and commits).

# Help

Check out our [help site](https://help.codestream.com) for more information on getting started with CodeStream.
