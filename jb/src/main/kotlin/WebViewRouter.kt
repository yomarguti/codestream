package com.codestream

import com.google.gson.JsonElement
import com.google.gson.JsonParser
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import kotlinx.coroutines.*

class WebViewRouter(val project: Project) {
    private val logger = Logger.getInstance(WebViewRouter::class.java)

    private val agentService: AgentService
        get() = ServiceManager.getService(project, AgentService::class.java)

    private val authenticationService: AuthenticationService
        get() = ServiceManager.getService(project, AuthenticationService::class.java)

    fun handle(rawMessage: String, origin: String) = GlobalScope.launch {
        try {
            val message = parse(rawMessage)
            when (message?.type) {
                "codestream:view-ready" -> Unit
                "codestream:request" -> processRequest(message.body)
                "codestream:interaction:active-panel-changed" -> Unit
                "codestream:interaction:context-state-changed" -> Unit
                "codestream:interaction:changed-active-stream" -> Unit
            }
        } catch (e: Exception) {
            logger.error(e)
            e.printStackTrace()
        }
    }

    private suspend fun processRequest(bodyElement: JsonElement?) {
        if (bodyElement == null || bodyElement.isJsonNull) {
            return
        }
        val body = bodyElement.asJsonObject

        val action = body.get("action").asString
        val id = body.get("id").asString

        val params = body.get("params")
        when (action) {
            "bootstrap" -> authenticationService.bootstrap(id)
            "authenticate" -> authenticationService.authenticate(
                id,
                params.asJsonObject.get("email").asString,
                params.asJsonObject.get("password").asString
            )
            "go-to-signup" -> authenticationService.goToSignup(id)
            "go-to-slack-signin" -> authenticationService.goToSlackSignin(id)
            "validate-signup" -> authenticationService.validateSignup(id) //, bodyElement.Params?.Value<string>())
            "show-markers",
            "open-comment-on-select" -> Unit
            "mute-all" -> Unit
            "show-code" -> Unit
            else -> agentService.sendRequest(id, action, params)
        }


    }

    private fun parse(json: String): WebViewMessage {
        val parser = JsonParser()
        val jsonObject = parser.parse(json).asJsonObject

        val type = jsonObject.get("type").asString
        val body = jsonObject.get("body")

        return WebViewMessage(type, body)
    }

    class WebViewMessage(val type: String, val body: JsonElement?)

}

