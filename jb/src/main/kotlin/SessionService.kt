package com.codestream

import com.intellij.openapi.project.Project
import protocols.agent.UserLoggedIn
import java.util.*
import kotlin.properties.Delegates


typealias UserLoggedInObserver = (UserLoggedIn?) -> Unit


class SessionService(val project: Project) {

    var userLoggedIn : UserLoggedIn? by Delegates.observable<UserLoggedIn?>(null) { prop, old, new ->
        userLoggedInObservers.forEach { it(new) }
    }
    private val userLoggedInObservers = mutableListOf<UserLoggedInObserver>()
    fun onUserLoggedInChanged(observer: UserLoggedInObserver) {
        userLoggedInObservers += observer
    }

    val isSignedIn: Boolean
        get() = userLoggedIn != null

    val signupToken: String by lazy {
        UUID.randomUUID().toString()
    }

}

