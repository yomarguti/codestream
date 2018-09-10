# CodeStream BETA

CodeStream is the knowledge base behind your codebase. CodeStream allows your development team to collaborate within Visual Studio Code and conversation threads automatically become annotations that live with your codebase forever, so your codebase gets smarter over time.

![FullIDE](https://help.codestream.com/hc/article_attachments/360008724052/FullScreen.png)

# Requirements

- CodeStream requires a current version of **[Visual Studio Code](https://code.visualstudio.com/)**.
- Your repository must be managed by Git, or a Git hosting service like GitHub.

# Things to Try

## Discuss some code

To talk about a specific block of code, just select the code in your buffer and then click on the light bulb that appears at the left of your selection and choose _Add CodeStream Comment_ (or set up a keybinding for the command). CodeStream will even automatically @mention the author of the code.

![PostCodeBlock](https://help.codestream.com/hc/article_attachments/360007936372/VSCPost.png)

## Add comments to ongoing discussions

Click on any post in the chat stream to add a comment. If the post included a code block, you’ll automatically be taken to the appropriate souce file and scrolled to the code block. If the code block doesn’t match what you have in your buffer, you’ll have options to view a diff or even apply the changes to your buffer.

![ThreadView](https://help.codestream.com/hc/article_attachments/360008723191/Screen_Shot_2018-08-06_at_5.12.03_PM.png)

##  Leverage your team's knowledge base

If you see a marker to the left of a block of code in your source file, that means that a discussion took place about that code. Hover over the marker and click _Open Comment_ to view the discussion.

![Markers](https://help.codestream.com/hc/article_attachments/360009591551/Screen_Shot_2018-08-21_at_12.08.49_PM.png)

## Slack integration

Set up the Slack integration by typing "/slack" in any stream and all of your team’s messages on CodeStream will flow through to the channel of your choice on Slack. You can even reply to those messages right from Slack, and the replies will get posted to CodeStream.

![SlackIntegration](https://help.codestream.com/hc/article_attachments/360002212591/SlackCSBot.png)

## Visual Studio Live Share integration

Live Share is an excellent plugin from Microsoft that allows users of VS Code to share a project with teammates so that they can access it right from within their IDE. Once a share session has been started you can edit and debug together in real time. CodeStream extends Live Share functionality by creating a channel for each share session so that you can chat with the people you’re sharing with throughout the course of the share session.

![LiveShareIntegration](https://help.codestream.com/hc/article_attachments/360010003011/Screen_Shot_2018-08-27_at_1.09.00_PM.png)
![LiveShareChannels](https://help.codestream.com/hc/article_attachments/360009985332/Screen_Shot_2018-08-27_at_1.09.42_PM.png)

# Frequently Asked Questions

#### Where are messages stored?

Your team’s message history is stored in the cloud on CodeStream’s servers. Note that CodeStream does not store a copy of your source files. When a message includes a code block, a copy of that block is also stored in the cloud, but not the entirety of the source file.

#### Does it work across branches?

CodeStream recognizes that developers on your team may be working on different branches, or may simply have local changes that result in certain blocks of code being in different locations for each of them. If there are messages associated with those blocks of code, CodeStream ensures that each developer sees the discussion markers in the correct location despite the variations in each of their local buffers.

#### What access to Git does CodeStream require?

You won’t need to provide CodeStream with any Git (or GitHub, Bitbucket, etc.) credentials, as the plugin simply leverages your IDE’s access to Git. CodeStream uses Git to do things like automatically mention the most recent author when you share a block of code in a post, and to maintain the connection between that block of code and where it’s located in the source file as the file evolves over time (and commits).

#### Is CodeStream a free service?

CodeStream is free to use while in beta so we encourage you to try it out and send us your feedback and suggestions. CodeStream will remain free for open source projects and educational use. Pricing for commercial use, which will be on a per user basis and on par with other team chat and collaboration tools, will be announced in a few months.

# Help & Feedback

Check out our [help center](https://help.codestream.com) for more information on getting started with CodeStream. Please follow [@teamcodestream](http://twitter.com/teamcodestream) for product updates and to share feedback and questions. You may also [contact us](https://help.codestream.com/hc/en-us/requests/new) directly.
