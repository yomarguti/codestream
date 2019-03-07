<p align="center">
  <br />
  <a title="Learn more about CodeStream" href="https://codestream.com?utm_source=vsmarket&utm_medium=banner&utm_campaign=codestream"><img src="https://alt-images.codestream.com/codestream_logo_vsmarketplace.png" alt="CodeStream Logo" /></a>
</p>

# CodeStream

CodeStream helps dev teams discuss, review, and understand code. Discussing code is now as simple as commenting on a Google Doc — select the code and type your question. CodeStream turns conversation into documentation by capturing all of the discussion about your code, and saving it with your code. Each discussion is represented as a "codemark" that is permanently connected to the lines of code to which it refers.

![CodeStream](https://raw.githubusercontent.com/TeamCodeStream/CodeStream/master/images/CSforVS.PNG)

## Does your team use Slack?

Sign up for CodeStream using Slack so that discussions about code can be shared in your existing Slack channels and direct messages. Connecting to your Slack workspace allows developers to participate in discussions about code when they're not in their editor, or if they don’t use an editor supported by CodeSteam.

# Requirements

- CodeStream requires Visual Studio 2017 or later.
- Your repository must be managed by Git, or a Git hosting service like GitHub.
- In order to sign up with Slack, make sure your company doesn't require Slack apps to be pre-approved by an admin. CodeStream is not yet available in the Slack app directory.

# Things to Try

## Create a codemark and discuss some code

Create a codemark by selecting a block of code in your editor and then typing a question or comment. Keep in mind that, unlike with other solutions, you can discuss any line of code in any source file at any time, even if it’s code that you just typed into your editor and haven’t yet saved or committed.

![New Codemark](https://raw.githubusercontent.com/TeamCodeStream/CodeStream/master/images/NewCodemark1.png)

In addition to general comments and questions, there are specific types of codemarks for assigning issues, saving bookmarks, or generating a permalink to a specific block of code.

![Issue Codemark](https://raw.githubusercontent.com/TeamCodeStream/CodeStream/master/images/CodemarkIssue1.png)

CodeStream integrates with Jira, Trello, GitHub, Asana, Bitbucket, and GitLab, making it easy to create an issue tied to a specific block of code, and have that issue appear in your existing issue-tracking service.

## Add comments to ongoing discussions

Click on a codemark to participate in the discussion. If you have the repo open, you’ll automatically be taken to the appropriate source file and scrolled to the code block.

![Thread View](https://raw.githubusercontent.com/TeamCodeStream/CodeStream/master/images/ThreadView2.png)

## Leverage your team's knowledge base

A codemark displayed to the right of a block of code means that a discussion took place about that code. Click on the codemark to view the discussion and get some context for the work at hand.

![Codemark in Source File](https://raw.githubusercontent.com/TeamCodeStream/CodeStream/master/images/SpatialSingleMarker.png)

Click on the Search icon to explore your team’s entire knowledge base. Filters allow you to look at codemarks of a certain type, or a specific color.

![Codemarks tab](https://raw.githubusercontent.com/TeamCodeStream/CodeStream/master/images/CodemarksTab.png)

## Visual Studio Live Share integration

Live Share is an excellent plugin from Microsoft that allows users of Visual Studio to share a project with teammates so that they can access it right from within their IDE. Start a share session via `/liveshare`, or by clicking on a teammate's headshot, and you can continue to chat while you edit and debug together in real time.

![Message in Stream](https://raw.githubusercontent.com/TeamCodeStream/CodeStream/master/images/LiveShareStream.png)

# Frequently Asked Questions

#### Where are messages stored?

Your team’s message history is stored in the cloud on CodeStream’s servers. If your team is connected to Slack, however, CodeStream doesn't store your messages at all. The one exception is with codemarks, where the content and code block are stored by CodeStream as part of maintaining your knowledge base.

#### Does it work across branches?

CodeStream recognizes that developers on your team may be working on different branches, or may simply have local changes that result in certain blocks of code being in different locations for each of them. If there are messages associated with those blocks of code, CodeStream ensures that each developer sees the discussion markers in the correct location despite the variations in each of their local buffers.

#### What access to Git does CodeStream require?

You won’t need to provide CodeStream with any Git (or GitHub, Bitbucket, etc.) credentials, as the plugin simply leverages your IDE’s access to Git. CodeStream uses Git to do things like automatically mention the most recent author when you share a block of code in a post, and to maintain the connection between that block of code and where it’s located in the source file as the file evolves over time (and commits).

#### Is CodeStream a free service?

CodeStream is free to use while in beta so we encourage you to try it out and send us your feedback and suggestions. CodeStream will remain free for open source projects and educational use. Pricing for commercial use, which will be on a per user basis and on par with other team chat and collaboration tools, will be announced in a few months.

# Help & Feedback

Check out our [wiki](https://github.com/TeamCodeStream/CodeStream/wiki) for more information on getting started with CodeStream. Please follow [@teamcodestream](http://twitter.com/teamcodestream) for product updates and to share feedback and questions. You can also email us at support@codestream.com.
