package com.codestream

import com.intellij.openapi.project.Project
import protocols.agent.LoginResult
import protocols.agent.UserLoggedIn
import java.util.*

class SessionService(project: Project) {

    var userLoggedIn: UserLoggedIn? = null

    val isSignedIn: Boolean
        get() = userLoggedIn != null

    val signupToken: String by lazy {
        UUID.randomUUID().toString()
    }

}

