package com.codestream.notification

import com.codestream.CODESTREAM_TOOL_WINDOW_ID
import com.codestream.codeStream
import com.codestream.protocols.webview.StreamNotifications
import com.codestream.sessionService
import com.codestream.settingsService
import com.codestream.webViewService
import com.intellij.notification.NotificationAction
import com.intellij.notification.NotificationDisplayType
import com.intellij.notification.NotificationGroup
import com.intellij.notification.NotificationType
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.IconLoader
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch
import protocols.agent.Post
import protocols.agent.StreamType

const val CODESTREAM_NOTIFICATION_GROUP_ID = "CodeStream"

class NotificationComponent(val project: Project) {

    private val icon = IconLoader.getIcon("/images/codestream-unread.svg")
    private val notificationGroup =
        NotificationGroup(
            CODESTREAM_NOTIFICATION_GROUP_ID,
            NotificationDisplayType.BALLOON,
            false,
            CODESTREAM_TOOL_WINDOW_ID,
            icon
        )

    init {
        project.sessionService?.onPostsChanged(this::didChangePosts)
    }

    private fun didChangePosts(posts: List<Post>) {
        val settings = project.settingsService ?: return

        if (settings.notifications == "none") return

        GlobalScope.launch {
            posts.forEach { didChangePost(it) }
        }
    }

    private suspend fun didChangePost(post: Post) {
        val codeStream = project.codeStream ?: return
        val session = project.sessionService ?: return
        val settings = project.settingsService ?: return
        val userLoggedIn = session.userLoggedIn ?: return

        if (!post.isNew || post.creatorId == userLoggedIn.userId) {
            return
        }

        val isMentioned = post.mentionedUserIds?.contains(userLoggedIn.userId) ?: false
        val isMutedStream = userLoggedIn.user.preferences.mutedStreams?.get(post.streamId) == true
        if (isMutedStream && !isMentioned) {
            return
        }

        val isStreamVisible = codeStream.isVisible && settings.currentStreamId == post.streamId
        val stream = session.getStream(post.streamId)

        if (settings.notifications == "all") {
            if (!isStreamVisible) {
                showNotification(post)
            } else if (isMentioned || (!isStreamVisible && stream?.type == StreamType.DIRECT)) {
                showNotification(post)
            }
        } else if (settings.notifications == "mentions") {
            if (isMentioned || (!isStreamVisible && stream?.type == StreamType.DIRECT)) {
                showNotification(post)
            }
        }
    }

    fun showError(title: String, content: String) {
        val notification = notificationGroup.createNotification(title, null, content, NotificationType.ERROR)
        notification.notify(project)
    }

    private suspend fun showNotification(post: Post) {
        val session = project.sessionService ?: return
        val sender =
            if (post.creatorId != null)
                session.getUser(post.creatorId)?.username ?: "Someone"
            else "Someone"
        val stream = session.getStream(post.streamId) ?: return
        val subtitle = if (stream.type != StreamType.DIRECT) {
            "${stream.name}: $sender"
        } else {
            sender
        }

        val notification = notificationGroup.createNotification(
            null, subtitle, post.text, NotificationType.INFORMATION
        )
        notification.addAction(NotificationAction.createSimple("Open") {
            project.codeStream?.show {
                project.webViewService?.run {
                    postNotification(StreamNotifications.Show(post.streamId))
                    notification.expire()
                }
            }
        })
        notification.notify(project)
    }
}

