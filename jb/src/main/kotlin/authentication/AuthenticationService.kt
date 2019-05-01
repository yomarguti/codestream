package com.codestream.authentication

import com.codestream.agentService
import com.codestream.editorService
import com.codestream.gson
import com.codestream.notificationComponent
import com.codestream.sessionService
import com.codestream.settingsService
import com.codestream.webViewService
import com.codestream.webview.WebViewRouter
import com.github.salomonbrys.kotson.fromJson
import com.github.salomonbrys.kotson.jsonObject
import com.github.salomonbrys.kotson.obj
import com.github.salomonbrys.kotson.set
import com.google.gson.JsonElement
import com.intellij.credentialStore.Credentials
import com.intellij.ide.BrowserUtil
import com.intellij.ide.passwordSafe.PasswordSafe
import com.intellij.openapi.project.Project
import kotlinx.coroutines.future.await
import protocols.agent.AccessToken
import protocols.agent.BootstrapParams
import protocols.agent.LoginWithPasswordParams
import protocols.agent.LoginWithSignupTokenParams
import protocols.agent.LoginWithTokenParams
import protocols.webview.Capabilities
import protocols.webview.LoginRequest
import protocols.webview.Services
import protocols.webview.SignedInBootstrapResponse
import protocols.webview.SignedOutBootstrapResponse
import protocols.webview.UserSession
import java.util.concurrent.CompletableFuture

class AuthenticationService(val project: Project) {

    suspend fun bootstrap(): Any? {
        val settings = project.settingsService ?: return Unit
        val agent = project.agentService ?: return Unit
        val session = project.sessionService ?: return Unit
        val notification = project.notificationComponent ?: return Unit

        if (settings.state.autoSignIn) {
            val token = PasswordSafe.instance.getPassword(settings.credentialAttributes)

            if (token != null) {
                val loginResult = agent.agent.login(
                    LoginWithTokenParams(
                        settings.state.email,
                        AccessToken(
                            settings.state.email,
                            settings.state.serverUrl,
                            token
                        ),
                        settings.state.serverUrl,
                        settings.extensionInfo,
                        settings.ideInfo,
                        settings.traceLevel.value,
                        settings.isDebugging,
                        settings.team,
                        settings.proxySupport,
                        settings.proxySettings
                    )
                ).await()

                loginResult.result.error?.let {
                    notification.showError("Error", it)
                    return buildSignedOutResponse()
                }

                val bootstrapFuture = agent.agent.bootstrap(BootstrapParams())
                session.login(loginResult.result.userLoggedIn)

                return buildSignedInResponse(bootstrapFuture)
            }
        }

        return buildSignedOutResponse()
    }

    suspend fun login(message: WebViewRouter.WebViewMessage): Any? {
        val settings = project.settingsService ?: return jsonObject()
        val agent = project.agentService ?: return jsonObject()
        val session = project.sessionService ?: return jsonObject()

        val params = gson.fromJson<LoginRequest>(message.params!!)
        val loginResult = agent.agent.login(
            LoginWithPasswordParams(
                params.email,
                params.password,
                settings.state.serverUrl,
                settings.extensionInfo,
                settings.ideInfo,
                settings.traceLevel.value,
                settings.isDebugging,
                settings.team,
                settings.proxySupport,
                settings.proxySettings
            )
        ).await()

        loginResult.result.error?.let {
            throw Exception(it)
        }

        val bootstrapFuture = agent.agent.bootstrap(BootstrapParams())
        session.login(loginResult.result.userLoggedIn)
        settings.state.email = params.email
        saveAccessToken(loginResult.result.loginResponse?.accessToken)
        return buildSignedInResponse(bootstrapFuture)
    }

    suspend fun signupComplete(): Any? {
        val agent = project.agentService ?: return jsonObject()
        val session = project.sessionService ?: return jsonObject()
        val settings = project.settingsService ?: return jsonObject()

        val token = session.signupToken
        val loginResult = agent.agent.login(
            LoginWithSignupTokenParams(
                token,
                settings.state.serverUrl,
                settings.extensionInfo,
                settings.ideInfo,
                settings.traceLevel.value,
                settings.isDebugging,
                settings.team,
                settings.proxySupport,
                settings.proxySettings
            )
        ).await()

        loginResult.result.error?.let {
            throw Exception(it)
        }

        if (loginResult.result.loginResponse == null) {
            throw Exception("Login result from agent has no error but loginResponse is null")
        }

        val bootstrapFuture = agent.agent.bootstrap(BootstrapParams())
        session.login(loginResult.result.userLoggedIn)
        settings.state.email = loginResult.result.loginResponse.user.email
        saveAccessToken(loginResult.result.loginResponse.accessToken)
        return buildSignedInResponse(bootstrapFuture)
    }

    fun slackLogin() {
        val session = project.sessionService ?: return
        val settings = project.settingsService ?: return
        BrowserUtil.browse("${settings.state.webAppUrl}/service-auth/slack?state=${session.signupToken}")
    }

    fun signup() {
        val session = project.sessionService ?: return
        val settings = project.settingsService ?: return
        BrowserUtil.browse("${settings.state.webAppUrl}/signup?force_auth=true&signup_token=${session.signupToken}")
    }

    suspend fun logout() {
        val agent = project.agentService ?: return
        val session = project.sessionService ?: return
        val settings = project.settingsService ?: return
        val webView = project.webViewService ?: return

        session.logout()
        agent.restart()
        saveAccessToken(null)
        settings.setWebViewContextJson(jsonObject())
        webView.reload()
    }

    private fun saveAccessToken(accessToken: String?) {
        val settings = project.settingsService ?: return
        val credentials = accessToken?.let {
            Credentials(null, it)
        }

        PasswordSafe.instance.set(
            settings.credentialAttributes,
            credentials
        )
    }

    private suspend fun buildSignedInResponse(bootstrapFuture: CompletableFuture<JsonElement>): JsonElement? {
        val settingsService = project.settingsService ?: return null
        val sessionService = project.sessionService ?: return null
        val editorService = project.editorService ?: return null

        val webViewResponse = SignedInBootstrapResponse(
            Capabilities(
                true,
                false,
                false,
                true,
                Services(false)
            ),
            settingsService.webViewConfigs,
            settingsService.environment,
            settingsService.environmentVersion,
            settingsService.getWebViewContextJson(),
            editorService.getEditorContext(),
            UserSession(
                sessionService.userLoggedIn!!.userId
            )
        )

        val webViewResponseJson = gson.toJsonTree(webViewResponse)
        val bootstrapResponse = bootstrapFuture.await()

        for ((key, value) in bootstrapResponse.obj.entrySet()) {
            webViewResponseJson[key] = value
        }

        return webViewResponseJson
    }

    private fun buildSignedOutResponse(): SignedOutBootstrapResponse? {
        val settings = project.settingsService ?: return null
        return SignedOutBootstrapResponse(
            Capabilities(false, false, false, false, Services(false)),
            mapOf("email" to settings.state.email),
            settings.environment,
            settings.environmentVersion
        )
    }
}
