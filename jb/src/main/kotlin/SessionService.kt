package com.codestream

import com.intellij.openapi.project.Project

class SessionService(project: Project) {
    var isSignedIn = false
    var teamId: String? = null
    var userId: String? = null
}