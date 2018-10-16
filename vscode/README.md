# CodeStream BETA

CodeStream puts Slack right inside VS Code, and saves all of your discussions about code, with the code. The end result is that your source files become annotated with your team’s code-related discussions, delivering the full wisdom of every developer who has contributed to your codebase. Your discussions become documentation for your source tree, creating a knowledge base from which future developers can learn.

### Does your team use Slack? ###
Sign into CodeStream using Slack and all of your team’s channels and direct messages will be accessible from within CodeStream. Leverage your existing chat platform, while still being able to connect discussions to specific blocks of code. Slack functionality now available in your editor includes:

- Join and create Slack channels
- Find and start Slack direct messages
- Scroll through the entire history of a Slack channel or DM
- Unread message indicators on Slack get cleared when you read messages on CodeStream
- @mention your teammates on Slack, even if they aren’t on CodeStream
- Use emoji and reactions
- Edit and delete Slack messages from CodeStream

If your team doesn’t use Slack, you can create channels using CodeStream.


![CodeStream](https://raw.githubusercontent.com/TeamCodeStream/CodeStream/master/images/CodeStream.png)
# Requirements

- CodeStream requires a current version of [Visual Studio Code](https://code.visualstudio.com/).
- Your repository must be managed by Git, or a Git hosting service like GitHub.
- In order to sign up with Slack, make sure your company doesn't require Slack apps to be pre-approved by an admin. CodeStream is not yet available in the Slack app directory.

# Things to Try

## Discuss some code

To talk about a specific block of code, just select the code in your buffer and then click on the light bulb that appears at the left of your selection and choose _Add CodeStream Comment_ (or set up a keybinding for the command). CodeStream will even automatically @mention the author of the code.

![Add Comment](https://raw.githubusercontent.com/TeamCodeStream/CodeStream/master/images/AddCSComment.png)

## Add comments to ongoing discussions

Click on any post in the chat stream to add a comment. If the post included a code block, you’ll automatically be taken to the appropriate source file and scrolled to the code block. If the code block doesn’t match what you have in your buffer, you’ll have options to view a diff or even apply the changes to your buffer.

![Thread View](https://raw.githubusercontent.com/TeamCodeStream/CodeStream/master/images/ThreadView.png)

##  Leverage your team's knowledge base

If you see a marker to the left of a block of code in your source file, that means that a discussion took place about that code. Hover over the marker and click _Open Comment_ to view the discussion.

![Discussion Marker](https://raw.githubusercontent.com/TeamCodeStream/CodeStream/master/images/Marker.png)

## Visual Studio Live Share integration

Live Share is an excellent plugin from Microsoft that allows users of VS Code to share a project with teammates so that they can access it right from within their IDE. Once a share session has been started you can edit and debug together in real time. CodeStream extends Live Share functionality by creating a channel for each share session so that you can chat with the people you’re sharing with throughout the course of the share session.

![Message in Stream](https://raw.githubusercontent.com/TeamCodeStream/CodeStream/master/images/LiveShareStream.png)
![Live Share Channels](https://raw.githubusercontent.com/TeamCodeStream/CodeStream/master/images/LiveShareChannels.png)

# Frequently Asked Questions

#### Where are messages stored?

Your team’s message history is stored in the cloud on CodeStream’s servers, unless your team is connected to Slack, in which case CodeStream doesn't store your messages at all. In either case, if a message is attached to a block of code, a copy of that block is stored in the cloud (but not the entirety of the source file).

#### Does it work across branches?

CodeStream recognizes that developers on your team may be working on different branches, or may simply have local changes that result in certain blocks of code being in different locations for each of them. If there are messages associated with those blocks of code, CodeStream ensures that each developer sees the discussion markers in the correct location despite the variations in each of their local buffers.

#### What access to Git does CodeStream require?

You won’t need to provide CodeStream with any Git (or GitHub, Bitbucket, etc.) credentials, as the plugin simply leverages your IDE’s access to Git. CodeStream uses Git to do things like automatically mention the most recent author when you share a block of code in a post, and to maintain the connection between that block of code and where it’s located in the source file as the file evolves over time (and commits).

#### Is CodeStream a free service?

CodeStream is free to use while in beta so we encourage you to try it out and send us your feedback and suggestions. CodeStream will remain free for open source projects and educational use. Pricing for commercial use, which will be on a per user basis and on par with other team chat and collaboration tools, will be announced in a few months.

# Help & Feedback

Check out our [wiki](https://github.com/TeamCodeStream/CodeStream/wiki) for more information on getting started with CodeStream. Please follow [@teamcodestream](http://twitter.com/teamcodestream) for product updates and to share feedback and questions. You can also email us at support@codestream.com.
