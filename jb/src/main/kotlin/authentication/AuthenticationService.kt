package com.codestream.authentication

import com.codestream.agentService
import com.codestream.gson
import com.codestream.sessionService
import com.codestream.settingsService
import com.github.salomonbrys.kotson.fromJson
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.intellij.credentialStore.Credentials
import com.intellij.ide.passwordSafe.PasswordSafe
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import kotlinx.coroutines.future.await
import protocols.agent.LoginResult
import protocols.agent.LoginWithTokenParams
import protocols.webview.BootstrapResponse
import protocols.webview.Capabilities
import protocols.webview.Ide
import protocols.webview.UserSession

class AuthenticationService(val project: Project) {

    private val logger = Logger.getInstance(AuthenticationService::class.java)
    private var agentCapabilities: JsonElement = gson.toJsonTree(Capabilities())

    fun bootstrap(): Any? {
        val settings = project.settingsService ?: return Unit
        val session = project.sessionService ?: return Unit

        return BootstrapResponse(
            UserSession(session.userLoggedIn?.userId),
            gson.fromJson(agentCapabilities),
            settings.webViewConfigs,
            settings.webViewContext,
            settings.extensionInfo.versionFormatted,
            Ide(settings.ideInfo.name)
        )
    }

    suspend fun autoSignIn(): Boolean {
        val settings = project.settingsService ?: return true
        if (!settings.state.autoSignIn) return true
        val tokenStr = PasswordSafe.instance.getPassword(settings.credentialAttributes) ?: return true
        val agent = project.agentService?.agent ?: return true

        try {
            val token = gson.fromJson<JsonObject>(tokenStr)
            val loginResult =
                agent.loginToken(
                    LoginWithTokenParams(
                        token,
                        settings.state.teamId,
                        settings.team
                    )
                ).await()

            return if (loginResult.error != null) {
                logger.warn(loginResult.error)
                settings.state.teamId = null
                saveAccessToken(null)
                false
            } else {
                completeLogin(loginResult)
                true
            }
        } catch (err: Exception) {
            logger.warn(err)
            return false
        }
    }

    fun completeLogin(result: LoginResult) {
        if (project.sessionService?.userLoggedIn == null) {
            result.state?.let {
                agentCapabilities = it.capabilities
                project.settingsService?.state?.teamId = it.teamId
                project.settingsService?.setWebViewContextJson(gson.toJsonTree(mapOf("currentTeamId" to it.teamId)))
                saveAccessToken(it.token)
            }
            project.sessionService?.login(result.userLoggedIn)
        }
    }

    suspend fun logout() {
        val agent = project.agentService ?: return
        val session = project.sessionService ?: return
        val settings = project.settingsService ?: return

        session.logout()
        agent.restart()
        settings.state.teamId = null
        saveAccessToken(null)
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
}
