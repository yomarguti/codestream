---
title: CodeStream Master Plan
published: true
description: Why we built a new way for developers to talk about code
tags: vscode, slack, chat, knowledge base
---

CodeStream's impact will be measured by our ability to make software development more enjoyable and productive, as we dramatically reduce the barriers to understanding code and contributing to a codebase.

### The Problem
The mental mapping required to translate computer code into something a person can understand is a sufficiently complex activity that developers have coined a word for it: to grok.

    Grok verb
    	 \ ˈgräk  \
	   to understand profoundly and intuitively

Today, understanding existing code consumes [up to 75% of an average developer’s time](https://www.quora.com/It-is-true-that-developers-spend-most-of-their-time-reading-code-than-writing-code), making it unnecessarily difficult to contribute ideas and solutions to existing code. In addition, [fewer than 20% of developers use internal tools to learn about the codebase they were hired to work on](https://insights.stackoverflow.com/survey/2018/#developer-profile-ways-developers-learn-on-their-own), leaving developers largely on their own in figuring out the right path forward.

Developers have always appreciated the necessity to communicate about source code within the source code itself. Some of the first examples of computer programs, [dating back to 1936](https://ricardodsanchez.com/2015/08/31/programming-a-short-history-of-computer-languages/), include code comments that bridge a connection between machine-readable code and human-readable understanding.

And yet despite the invention of literally thousands of programming languages, including programs that can write programs, in the eighty years since the first code comments were introduced, the process of commenting on code has remained essentially unchanged. Hundreds of thousands of innovations about every imaginable part of the software development process, and still not a single effective improvement to the way we map software to wetware.

At CodeStream, we want to fix this by creating a set of systems that make it dramatically easier to discuss source code with other people, and capture all of the discussion and activity about your codebase exactly where it belongs: with your code.

**Make it Easier to Understand Code by Making it Easier to Talk About Code**
If the hardest part of every developer’s job is to understand the code she is looking at, the easiest way for her to learn is to talk to the author of that code. That’s surprisingly difficult to do today using existing tools which generally fall into two categories.

First you have code-specific lifecycle tools, such as GitHub PR comments, which are limited in terms of what code you can talk about, essentially vanish once the PR is merged, are generally disconnected from your editor, and lack modern messaging capabilities.

Then there are general-purpose communication tools, such as Slack or Microsoft Teams, which are divorced from codebase and require a deep context switch to engage. How deep?

Imagine if every time you wanted to ask a question about a Google Doc you had to…
- Copy the URL of the document
- Switch to a new tab in your browser and open up Gmail
- Type the recipients in the To field
- Paste in the URL of the document
- Describe your question: “In the above linked document, on page three, in the second paragraph, in the third sentence right after the first clause where you say ‘foo bar’, what did you mean?”

…and yet if you substitute “source code” for “Google Doc” and “Slack” for “Gmail” that’s essentially what developers have to fight through today, every single time they want to do something as simple as ask a question about the codebase they are working on.


Here’s how we will bring simple, powerful code collaboration to every team:
- Provide the ability to talk about any block of code, on any branch, in any state, without leaving your editor, as simple as “select the code, type your comment.”
- Eliminate context switching costs by embedding modern messaging support, such as synchronous or asynchronous communication, channels and DMs, at-mentions and slash commands, etc., right in the editor.
- Create a way to easily share works-in-progress by simply authoring code and commenting on it.
- Treat codeblocks as a first-class object in your message stream by making them actionable so you can easily share uncommitted code for feedback, exchange patches for quick fixes outside of a formal git process (branch...commit...push...pull...), and diff shared code blocks.


This approach solves the single largest hurdle to making code conversation more common, which is to eliminate the friction inherent in using a myriad of software development tools not designed for communication, and general-purpose communication tools not designed for software development.

—

**Every CodeBase Should have a Knowledge Base**
Today, development teams around the world use git to track every change to every line of every file, all the way back to the project’s inception. And yet those same teams are taking all the discussion about that code, which often explains how it all works, and are unwittingly throwing it away in Slack or Gmail, or burying it in a PR comment. Even worse, third-party tools that are related to your codebase are either completely disconnected in a walled garden, or at best they update an ephemeral Slack channel, ill-suited to knowledge retention.

Every piece of information about your codebase should be saved with your codebase, visible to every developer in the context of looking at a file or a function, at any time. This simple concept is, rather surprisingly, not implemented by any tool in widespread use today.

Legacy code comments (/* like this */), when used properly, are effective as a form of documentation for one simple reason: the comments retain local proximity to the code they refer to. We imagine a marker system which allows arbitrary data to be associated with a codeblock, connecting discussion and activity to lines of code.

Markers should:
- Be visible wherever the source code is visible, including in the editor.
- Mark a line or a range of code, providing specific context.
- Move with the code they refer to, as needed, when the code changes, across commits and branches, remaining relevant to future versions of functions and files, and for every developer on the team regardless of which version is checked out.
- Be created and updated at any time, independent of git commit cadence.
- Be replied to, enabling comment conversation.
- Be delivered in real-time.
- Be cross-posted to existing communication tools, such as Slack, MS Teams or Email.
- Automatically at-mention the author(s) of the code they are referring to.
Connect with third-party tools, so CI, code review, and crash reporting tools can create and update markers within your source tree.

By connecting team discussion and system activity directly to your source code, markers become documentation for your source tree, annotating the source files themselves, and create a knowledge base from which future developers can learn.

Thus, a virtuous cycle is born:
- New developers on the team, rather than having to learn from a naked codebase, get a head-start by having access to all prior conversation and activity that has been captured for every function and every file.
- As those developers learn the codebase, they can much more easily ask new questions because of comment integration within the editor.
- These additional questions will result in conversation and answers, tied to markers, which are captured with the code, building the knowledge base further, and giving the next developers an even bigger head-start.

Comments on steroids. Connected to your tools. Captured with your code.

—

So, in short, the master plan is:
- Make it easier for developers to talk about code, so they do it more often.
- Capture those conversations within your source tree, making it more understandable.
- Connect your tool output to your source tree, retaining critical information about your code.
- Improve the way your team works by connecting thoughts, ideas, and activity to software implementation specifics, so your code is better understood, easier to change, and faster to market.

Better teamwork, better code.



