package com.codestream

import com.intellij.openapi.project.Project
import protocols.agent.UserLoggedIn
import java.util.*
import kotlin.properties.Delegates


typealias UserLoggedInObserver = (UserLoggedIn?) -> Unit
typealias IntObserver = (Int) -> Unit


class SessionService(val project: Project) {

    val userLoggedIn: UserLoggedIn? get() = _userLoggedIn
    private var _userLoggedIn : UserLoggedIn? by Delegates.observable<UserLoggedIn?>(null) { prop, old, new ->
        userLoggedInObservers.forEach { it(new) }
    }
    private val userLoggedInObservers = mutableListOf<UserLoggedInObserver>()
    fun onUserLoggedInChanged(observer: UserLoggedInObserver) {
        userLoggedInObservers += observer
    }

    val unreads: Int get() = _unreads
    private var _unreads : Int by Delegates.observable(0) { prop, old, new ->
        unreadsObservers.forEach { it(new) }
    }
    private val unreadsObservers = mutableListOf<IntObserver>()
    fun onUnreadsChanged(observer: IntObserver) {
        unreadsObservers += observer
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
    }

    val isSignedIn: Boolean
        get() = userLoggedIn != null

    val signupToken: String by lazy {
        UUID.randomUUID().toString()
    }

}

