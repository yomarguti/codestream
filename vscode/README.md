# CodeStream

CodeStream is the knowledge base behind your codebase. CodeStream allows your development team to collaborate within Visual Studio Code and conversation threads automatically become annotations that live with your codebase forever, so your codebase gets smarter over time.

![FullIDE](https://help.codestream.com/hc/article_attachments/360008724052/FullScreen.png)

# Beta

CodeStream is currently in beta. The core messaging functionality, which is the heart of the service, is there and ready for you to use. Some other components of the service are still in the works.

- Your primary interaction with CodeStream is in the IDE, but there will also be a web component to the service that will include settings, profile and administration. All of that is coming very soon.
- Since we don’t have settings yet, you won’t have control over your email notifications. You can read our [guide to CodeStream notifications](https://help.codestream.com/hc/en-us/articles/360000327691-Guide-to-CodeStream-notifications), but the key thing is that if you want to turn emails off, just get in touch with us and we’ll take care of it for you.
- CodeStream currently uses [Gravatar](https://gravatar.com) for headshots. Upload a headshot there and associate it with the email address you use on CodeStream.

# Requirements

- CodeStream requires a current version of **[Visual Studio Code](https://code.visualstudio.com/)**.
- Your repository must be managed by Git, or a Git hosting service like GitHub.

# Things to Try

- To talk about a specific block of code, just select the code in your buffer and then click on the light bulb that appears at the left of your selection and choose _Add CodeStream Comment_.

![PostCodeBlock](https://help.codestream.com/hc/article_attachments/360007936372/VSCPost.png)

- Click on any post in the chat stream to add a comment. If the post included a code block, you’ll automatically be scrolled to the appropriate location in the source file. If the code block doesn’t match what you have in your buffer, you’ll have options to view a diff or even apply the changes to your buffer.

![ThreadView](https://help.codestream.com/hc/article_attachments/360008723191/Screen_Shot_2018-08-06_at_5.12.03_PM.png)

- If you see a marker to the left of a block of code in your source file, that means that a discussion took place about that code. Hover over the marker and click _Open Comment_ to view the discussion.

![Markers](https://help.codestream.com/hc/article_attachments/360008723011/Screen_Shot_2018-08-06_at_5.03.41_PM.png)

- Set up the Slack integration by typing "/slack" in any stream and all of your team’s messages on CodeStream will flow through to the channel of your choice on Slack. You can even reply to those messages right from Slack, and the replies will get posted to CodeStream.

![SlackIntegration](https://help.codestream.com/hc/article_attachments/360002212591/SlackCSBot.png)

# Frequently Asked Questions

#### Where are messages stored?

Your team’s message history is stored in the cloud on CodeStream’s servers. Note that CodeStream does not store a copy of your source files. When a message includes a code block, a copy of that block is also stored in the cloud, but not the entirety of the source file.

#### Does it work across branches?

CodeStream recognizes that developers on your team may be working on different branches, or may simply have local changes that result in certain blocks of code being in different locations for each of them. If there are messages associated with those blocks of code, CodeStream ensures that each developer sees the discussion markers in the correct location despite the variations in each of their local buffers.

#### What access to Git does CodeStream require?

You won’t need to provide CodeStream with any Git (or GitHub, Bitbucket, etc.) credentials, as the plugin simply leverages your IDE’s access to Git. CodeStream uses Git to do things like automatically mention the most recent author when you share a block of code in a post, and to maintain the connection between that block of code and where it’s located in the source file as the file evolves over time (and commits).

# Help

Check out our [help site](https://help.codestream.com) for more information on getting started with CodeStream.
