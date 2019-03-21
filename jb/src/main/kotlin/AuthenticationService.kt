package com.codestream

import com.intellij.openapi.project.Project

class AuthenticationService(project: Project) : ServiceConsumer(project) {
//    suspend fun authenticate(id: String, email: String?, password: String?) {
//        val loginResult = agentService.login(email, password)
//        loginResult.error?.apply {
//            webViewService.postResponse(id, null, this)
//            return
//        }
//
//        sessionService.userLoggedIn = loginResult.userLoggedIn
//        val bootstrapState = agentService.getBootstrapState()
//        editorService.updateMarkers()
//        webViewService.postResponse(id, bootstrapState)
//    }

//    fun goToSignup(id: String) {
//        BrowserUtil.browse("${settingsService.webAppUrl}/signup?force_auth=true&signup_token=${sessionService.signupToken}")
//        webViewService.postResponse(id, true)
//    }

//    fun goToSlackSignin(id: String) {
//        BrowserUtil.browse("${settingsService.webAppUrl}/service-auth/slack?state=${sessionService.signupToken}")
//        webViewService.postResponse(id, true)
//    }

//    suspend fun validateSignup(id: String, signupToken: String?) {
//        val token = if (!signupToken.isNullOrBlank())
//            signupToken
//        else
//            sessionService.signupToken
//
//        val loginResult = agentService.loginViaOneTimeCode(token)
//        loginResult.error?.apply {
//            webViewService.postResponse(id, null, this)
//            return
//        }
//
//        sessionService.userLoggedIn = loginResult.userLoggedIn
//        val bootstrapState = agentService.getBootstrapState()
//        editorService.updateMarkers()
//        webViewService.postResponse(id, bootstrapState)
//    }

//    suspend fun signout() {
//        sessionService.userLoggedIn = null
//        agentService.logout()
//        webViewService.reload()
//    }

}

