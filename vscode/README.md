# CodeStream BETA

CodeStream captures all of the valuable discussions your development team has about code and saves them as "codemarks" that annotate your source files. In the aggregate, codemarks become documentation for your source tree and represent a knowledge base that your team builds up effortlessly over time. 

CodeStream also makes it incredibly easy to discuss code. No more copy-and-pasting blocks of code over into your chat app, where the conversation will quickly get lost in the channel history. On CodeStream simply select a block of code and then type your comment or question.

## Does your team use Slack? ###
When your team discusses code on CodeStream, the resulting codemarks are shared in channels and direct messages. If your team uses Slack, sign into CodeStream using Slack and all of your workspace's channels and direct messages will be accessible from within CodeStream. Leverage your existing chat platform, while still being able to create codemarks and build a knowledge base!

![CodeStream](https://raw.githubusercontent.com/TeamCodeStream/CodeStream/master/images/CodeStream1.png)
# Requirements

- CodeStream requires a current version of [Visual Studio Code](https://code.visualstudio.com/).
- Your repository must be managed by Git, or a Git hosting service like GitHub.
- In order to sign up with Slack, make sure your company doesn't require Slack apps to be pre-approved by an admin. CodeStream is not yet available in the Slack app directory.

# Things to Try

## Create a codemark and discuss some code

Create a codemark by selecting a block of code in your editor and then typing a question or comment. The New Codemark form will automatically pop up (although you can turn this behavior off). Keep in mind that, unlike with other solutions, you can discuss any line of code in any source file at any time, even if it’s code that you just typed into your editor and haven’t yet saved or committed.

![New Codemark](https://raw.githubusercontent.com/TeamCodeStream/CodeStream/master/images/NewCodemarkWithCode1.png)

In addition to general comments and questions, there are specific types of codemarks for assigning issues, creating code traps (i.e., identifying code that shouldn't be touched without prior discussion), and setting bookmarks.

![Issue Codemark](https://raw.githubusercontent.com/TeamCodeStream/CodeStream/master/images/CodemarkIssue.png)

## Add comments to ongoing discussions

Click on a codemark in the stream to participate in the discussion. If you have the repo open, you’ll automatically be taken to the appropriate source file and scrolled to the code block.

![Thread View](https://raw.githubusercontent.com/TeamCodeStream/CodeStream/master/images/ThreadView1.png)

##  Leverage your team's knowledge base

A codemark displayed to the left of a block of code in your source file means that a discussion took place about that code. Hover over the codemark and click _Open Comment_ to view the discussion.

![Codemark in Source File](https://raw.githubusercontent.com/TeamCodeStream/CodeStream/master/images/CodemarkHover.png)

You can also explore your knowledge base from the Codemarks tab. See all codemarks from the current file, all of your open issues, or filter the list however you see fit.

![Codemarks tab](https://raw.githubusercontent.com/TeamCodeStream/CodeStream/master/images/CodemarksTab.png)

## Visual Studio Live Share integration

Live Share is an excellent plugin from Microsoft that allows users of VS Code to share a project with teammates so that they can access it right from within their IDE. Start a share session via `/liveshare`, or by clicking on a teammate's headshot, and you can continue to chat while you edit and debug together in real time.

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
