package com.codestream.authentication

import com.codestream.agentService
import com.codestream.editorService
import com.codestream.gson
import com.codestream.protocols.webview.DidLogout
import com.codestream.sessionService
import com.codestream.settingsService
import com.codestream.webViewService
import com.codestream.webview.WebViewRouter
import com.github.salomonbrys.kotson.fromJson
import com.github.salomonbrys.kotson.get
import com.github.salomonbrys.kotson.jsonObject
import com.github.salomonbrys.kotson.obj
import com.github.salomonbrys.kotson.set
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.intellij.credentialStore.Credentials
import com.intellij.ide.BrowserUtil
import com.intellij.ide.passwordSafe.PasswordSafe
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import kotlinx.coroutines.future.await
import protocols.agent.AccessToken
import protocols.agent.BootstrapParams
import protocols.agent.LoginOtcParams
import protocols.agent.LoginWithPasswordParams
import protocols.agent.LoginWithTokenParams
import protocols.webview.Capabilities
import protocols.webview.LoginRequest
import protocols.webview.LoginSSORequest
import protocols.webview.SignedInBootstrapResponse
import protocols.webview.SignedOutBootstrapResponse
import protocols.webview.SignupCompleteRequest
import protocols.webview.UserSession
import protocols.webview.ValidateThirdPartyAuthRequest
import java.util.concurrent.CompletableFuture

class AuthenticationService(val project: Project) {

    private val logger = Logger.getInstance(AuthenticationService::class.java)
    private var agentCapabilities: JsonObject = JsonObject()

    suspend fun bootstrap(): Any? {
        val settings = project.settingsService ?: return Unit
        val agent = project.agentService ?: return Unit
        val session = project.sessionService ?: return Unit

        if (session.userLoggedIn != null) {
            val bootstrapFuture = agent.agent.bootstrap(BootstrapParams())
            return buildSignedInResponse(bootstrapFuture)
        }

        if (settings.state.autoSignIn) {
            val tokenStr = PasswordSafe.instance.getPassword(settings.credentialAttributes)

            if (tokenStr != null) {
                try {
                    val token = gson.fromJson<AccessToken>(tokenStr)
                    val loginResult = agent.agent.loginToken(
                        LoginWithTokenParams(
                            token,
                            settings.state.teamId,
                            settings.team
                        )
                    ).await()

                    loginResult.error?.let {
                        logger.warn(it)
                        return buildSignedOutResponse()
                    }

                    loginResult.state?.let {
                        agentCapabilities = it.capabilities
                        settings.state.teamId = it.teamId
                    }

                    val bootstrapFuture = agent.agent.bootstrap(BootstrapParams())
                    session.login(loginResult.userLoggedIn)

                    return buildSignedInResponse(bootstrapFuture)
                } catch (err: Exception) {
                    logger.warn(err)
                }
            }
        }

        return buildSignedOutResponse()
    }

    suspend fun login(message: WebViewRouter.WebViewMessage): Any? {
        val settings = project.settingsService ?: return jsonObject()
        val agent = project.agentService ?: return jsonObject()
        val session = project.sessionService ?: return jsonObject()

        val params = gson.fromJson<LoginRequest>(message.params!!)
        val loginResult = agent.agent.loginPassword(
            LoginWithPasswordParams(
                params.email,
                params.password,
                settings.state.teamId,
                settings.team
            )
        ).await()

        loginResult.error?.let {
            throw Exception(it)
        }

        loginResult.state?.let {
            agentCapabilities = it.capabilities
            settings.state.teamId = it.teamId
        }

        val bootstrapFuture = agent.agent.bootstrap(BootstrapParams())
        session.login(loginResult.userLoggedIn)
        settings.state.email = params.email
        saveAccessToken(loginResult.state?.token)
        return buildSignedInResponse(bootstrapFuture)
    }

    fun loginSSO(message: WebViewRouter.WebViewMessage) {
        val request = gson.fromJson<LoginSSORequest>(message.params!!)
        val session = project.sessionService ?: return
        val settings = project.settingsService ?: return
        BrowserUtil.browse("${settings.state.serverUrl}/web/provider-auth/${request.provider}?${if (!request.queryString.isNullOrEmpty()) "${request.queryString}&" else ""}signupToken=${session.signupToken}")
    }

    suspend fun validateThirdPartyAuth(request: ValidateThirdPartyAuthRequest): Any? {
        val agent = project.agentService ?: return jsonObject()
        val session = project.sessionService ?: return jsonObject()
        val settings = project.settingsService ?: return jsonObject()

        val loginResult = agent.agent.loginOtc(LoginOtcParams(
            session.signupToken,
            request.teamId,
            request.team,
            request.alias
        )).await()

        loginResult.error?.let {
            throw Exception(it)
        }

        loginResult.state?.let {
            agentCapabilities = it.capabilities
            settings.state.teamId = it.teamId
        }

        val bootstrapFuture = agent.agent.bootstrap(BootstrapParams())
        session.login(loginResult.userLoggedIn)
        settings.state.email = loginResult.loginResponse?.user?.email
        saveAccessToken(loginResult.state?.token)
        return buildSignedInResponse(bootstrapFuture)
    }

    suspend fun signupComplete(request: SignupCompleteRequest): Any? {
        val agent = project.agentService ?: return jsonObject()
        val session = project.sessionService ?: return jsonObject()
        val settings = project.settingsService ?: return jsonObject()

        val loginResult = agent.agent.loginToken(
            LoginWithTokenParams(
                AccessToken(
                    request.email,
                    settings.state.serverUrl,
                    request.token
                ),
                request.teamId,
                null
            )
        ).await()

        loginResult.error?.let {
            throw Exception(it)
        }

        loginResult.state?.let {
            agentCapabilities = it.capabilities
            settings.state.teamId = it.teamId
        }

        val bootstrapFuture = agent.agent.bootstrap(BootstrapParams())
        session.login(loginResult.userLoggedIn)
        settings.state.email = loginResult.loginResponse?.user?.email
        saveAccessToken(loginResult.state?.token)
        return buildSignedInResponse(bootstrapFuture)
    }

    suspend fun logout() {
        val agent = project.agentService ?: return
        val session = project.sessionService ?: return
        val webView = project.webViewService ?: return
        val settings = project.settingsService ?: return

        session.logout()
        agent.restart()
        settings.state.teamId = null
        saveAccessToken(null)
        webView.postNotification(DidLogout())
    }

    private fun saveAccessToken(accessToken: JsonObject?) {
        val settings = project.settingsService ?: return
        val credentials = accessToken?.let {
            Credentials(null, it.toString())
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
            Capabilities(),
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

        val capabilitiesJson = webViewResponseJson["capabilities"]
        for ((key, value) in agentCapabilities.entrySet()) {
            capabilitiesJson[key] = value
        }

        return webViewResponseJson
    }

    private fun buildSignedOutResponse(): SignedOutBootstrapResponse? {
        val settings = project.settingsService ?: return null
        return SignedOutBootstrapResponse(
            Capabilities(),
            mapOf("email" to settings.state.email),
            settings.environment,
            settings.environmentVersion
        )
    }
}
