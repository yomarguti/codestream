package com.codestream

import com.intellij.ide.BrowserUtil
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.project.Project

class AuthenticationService(project: Project) {

    val agentService: AgentService by lazy {
        ServiceManager.getService(project, AgentService::class.java)
    }

    val sessionService: SessionService by lazy {
        ServiceManager.getService(project, SessionService::class.java)
    }
    val settingsService: SettingsService by lazy {
        ServiceManager.getService(project, SettingsService::class.java)
    }
    val webViewService: WebViewService by lazy {
        ServiceManager.getService(project, WebViewService::class.java)
    }

    suspend fun bootstrap(id: String) {
        val bootstrapState = agentService.getBootstrapState()
        webViewService.postMessage(Ipc.toResponseMessage(id, gson.toJson(bootstrapState), null))
    }

    suspend fun authenticate(id: String, email: String?, password: String?) {
        val loginResult = agentService.login(email, password)

        loginResult.error?.apply {
            webViewService.postMessage(Ipc.toResponseMessage(id, null, this))
            return
        }

        sessionService.userLoggedIn = loginResult.userLoggedIn
        val bootstrapState = agentService.getBootstrapState()
        webViewService.postMessage(Ipc.toResponseMessage(id, gson.toJson(bootstrapState), null))
    }

    fun goToSignup(id: String) {
        try {
            BrowserUtil.browse("${settingsService.webAppUrl}/signup?force_auth=true&signup_token=${sessionService.signupToken}")
            webViewService.postMessage(Ipc.toResponseMessage(id, true, null))
        } catch (e: Exception) {
            webViewService.postMessage(Ipc.toResponseMessage(id, null, e.message))
        }
    }

    fun goToSlackSignin(id: String) {
        try {
            BrowserUtil.browse("${settingsService.webAppUrl}/service-auth/slack?state=${sessionService.signupToken}")
            webViewService.postMessage(Ipc.toResponseMessage(id, true, null))
        } catch (e: Exception) {
            webViewService.postMessage(Ipc.toResponseMessage(id, null, e.message))
        }
    }

    suspend fun validateSignup(id: String, signupToken: String?) {
        val token = if (!signupToken.isNullOrBlank())
            signupToken
        else
            sessionService.signupToken

        val loginResult = agentService.loginViaOneTimeCode(token)
        sessionService.userLoggedIn = loginResult.userLoggedIn
        val bootstrapState = agentService.getBootstrapState()
        webViewService.postMessage(Ipc.toResponseMessage(id, gson.toJson(bootstrapState), null))
    }

    suspend fun signout() {
        sessionService.userLoggedIn = null
        agentService.logout()
        webViewService.reload()
    }

}

