package com.codestream.session

import com.codestream.agent.DidChangeUnreadsNotification
import com.codestream.agentService
import com.intellij.openapi.project.Project
import protocols.agent.CSUser
import protocols.agent.Post
import protocols.agent.Stream
import protocols.agent.UserLoggedIn
import java.util.UUID
import kotlin.properties.Delegates

typealias UserLoggedInObserver = (UserLoggedIn?) -> Unit
typealias IntObserver = (Int) -> Unit
typealias PostsObserver = (List<Post>) -> Unit

class SessionService(val project: Project) {

    val userLoggedIn: UserLoggedIn? get() = _userLoggedIn
    val mentions: Int get() = _mentions

    private val _streams = mutableMapOf<String, Stream>()
    private val _users = mutableMapOf<String, CSUser>()

    suspend fun getStream(id: String): Stream? = _streams.getOrPut(id) {
        return project.agentService?.getStream(id)
    }

    suspend fun getUser(id: String): CSUser? = _users.getOrPut(id) {
        return project.agentService?.getUser(id)
    }

    private val userLoggedInObservers = mutableListOf<UserLoggedInObserver>()
    private val unreadsObservers = mutableListOf<IntObserver>()
    private val mentionsObservers = mutableListOf<IntObserver>()
    private val postsObservers = mutableListOf<PostsObserver>()

    private var _userLoggedIn: UserLoggedIn? by Delegates.observable<UserLoggedIn?>(null) { _, _, new ->
        userLoggedInObservers.forEach { it(new) }
    }

    private var _unreads: Int by Delegates.observable(0) { _, _, new ->
        unreadsObservers.forEach { it(new) }
    }

    private var _mentions: Int by Delegates.observable(0) { _, _, new ->
        mentionsObservers.forEach { it(new) }
    }

    fun onUserLoggedInChanged(observer: UserLoggedInObserver) {
        userLoggedInObservers += observer
    }

    fun onUnreadsChanged(observer: IntObserver) {
        unreadsObservers += observer
    }

    fun onMentionsChanged(observer: IntObserver) {
        mentionsObservers += observer
    }

    fun onPostsChanged(observer: PostsObserver) {
        postsObservers += observer
    }

    fun login(userLoggedIn: UserLoggedIn) {
        _userLoggedIn = userLoggedIn
    }

    fun logout() {
        _userLoggedIn = null
        _unreads = 0
    }

    fun didChangeUnreads(notification: DidChangeUnreadsNotification) {
        _unreads = notification.totalUnreads
        _mentions = notification.totalMentions
    }

    fun didChangePosts(posts: List<Post>) {
        postsObservers.forEach { it(posts) }
    }

    val signupToken: String by lazy {
        UUID.randomUUID().toString()
    }
}

