package com.codestream.webview

import com.codestream.agentService
import com.codestream.authenticationService
import com.codestream.editorService
import com.codestream.gson
import com.codestream.settingsService
import com.codestream.webViewService
import com.github.salomonbrys.kotson.fromJson
import com.github.salomonbrys.kotson.get
import com.github.salomonbrys.kotson.jsonObject
import com.github.salomonbrys.kotson.nullString
import com.github.salomonbrys.kotson.string
import com.google.gson.JsonElement
import com.google.gson.JsonParser
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.future.await
import kotlinx.coroutines.launch
import protocols.webview.ActiveEditorContextResponse
import protocols.webview.EditorRangeHighlightRequest
import protocols.webview.EditorRangeRevealRequest
import protocols.webview.EditorRangeRevealResponse
import protocols.webview.EditorRangeSelectRequest
import protocols.webview.EditorRangeSelectResponse
import protocols.webview.EditorScrollToRequest
import protocols.webview.MarkerApplyRequest
import protocols.webview.MarkerCompareRequest
import protocols.webview.UpdateConfigurationRequest

class WebViewRouter(val project: Project) {
    private val logger = Logger.getInstance(WebViewRouter::class.java)
    private var _isReady = false
    val isReady get() = _isReady

    fun reload() {
        _isReady = false
    }

    fun handle(rawMessage: String, origin: String?) = GlobalScope.launch {
        val message = parse(rawMessage)

        try {
            logger.debug("Handling ${message.method}")
            when (message.target) {
                "host" -> processHostMessage(message)
                "codestream" -> processAgentMessage(message)
                else -> throw IllegalArgumentException("Invalid webview message target: ${message.target}")
            }
        } catch (e: Exception) {
            logger.warn(e)
            if (message.id != null) {
                project.webViewService?.postResponse(message.id, null, e.message)
            }
        }
    }

    private suspend fun processAgentMessage(message: WebViewMessage) {
        val agentService = project.agentService ?: return
        val webViewService = project.webViewService ?: return
        val response = agentService.remoteEndpoint.request(message.method, message.params).await()
        if (message.id != null) {
            webViewService.postResponse(message.id, response)
        }
    }

    private suspend fun processHostMessage(message: WebViewMessage) {
        val authentication = project.authenticationService ?: return

        val response = when (message.method) {
            "host/bootstrap" -> authentication.bootstrap()
            "host/didInitialize" -> _isReady = true
            "host/logout" -> authentication.logout()
            "host/context/didChange" -> contextDidChange(message)
            "host/webview/reload" -> project.webViewService?.load()
            "host/marker/compare" -> hostMarkerCompare(message)
            "host/marker/apply" -> hostMarkerApply(message)
            "host/configuration/update" -> configurationUpdate(message)
            "host/editor/context" -> {
                ActiveEditorContextResponse(project.editorService?.getEditorContext())
            }
            "host/editor/range/highlight" -> editorRangeHighlight(message)
            "host/editor/range/reveal" -> editorRangeReveal(message)
            "host/editor/range/select" -> editorRangeSelect(message)
            "host/editor/scrollTo" -> editorScrollTo(message)
            else -> logger.warn("Unhandled host message ${message.method}")
        }
        if (message.id != null) {
            project.webViewService?.postResponse(message.id, response.orEmptyObject)
        }
    }

    private fun contextDidChange(message: WebViewMessage) {
        if (message.params == null) return
        val settingsService = project.settingsService ?: return
        settingsService.setWebViewContextJson(message.params["context"])
    }

    private fun configurationUpdate(message: WebViewMessage): Any {
        val notification = gson.fromJson<UpdateConfigurationRequest>(message.params!!)
        project.settingsService?.set(notification.name, notification.value)
        project.webViewService?.postNotification(
            "webview/config/didChange",
            jsonObject(notification.name to (notification.value == "true"))
        )
        return emptyMap<String, String>()
    }

    private fun hostMarkerApply(message: WebViewMessage) {
        val request = gson.fromJson<MarkerApplyRequest>(message.params!!)
        project.editorService?.applyMarker(request.marker)
    }

    private fun hostMarkerCompare(message: WebViewMessage) {
        val request = gson.fromJson<MarkerCompareRequest>(message.params!!)
        project.editorService?.compareMarker(request.marker)
    }

    private fun editorRangeHighlight(message: WebViewMessage) {
        val request = gson.fromJson<EditorRangeHighlightRequest>(message.params!!)

        // Numbers greater than Integer.MAX_VALUE are deserialized as -1. It should not happen,
        // but some versions of the plugin might do that trying to represent a whole line.
        if (request.range.end.character == -1) {
            request.range.end.character = Integer.MAX_VALUE
        }

        project.editorService?.toggleRangeHighlight(request.range, request.highlight)
    }

    private suspend fun editorRangeReveal(message: WebViewMessage): EditorRangeRevealResponse {
        val request = gson.fromJson<EditorRangeRevealRequest>(message.params!!)
        val success = project.editorService?.reveal(request.uri, request.range, request.atTop)
            ?: false
        return EditorRangeRevealResponse(success)
    }

    private suspend fun editorRangeSelect(message: WebViewMessage): EditorRangeSelectResponse {
        val request = gson.fromJson<EditorRangeSelectRequest>(message.params!!)
        val success = project.editorService?.select(request.uri, request.selection, request.preserveFocus ?: false)
            ?: false
        return EditorRangeSelectResponse(success)
    }

    private fun editorScrollTo(message: WebViewMessage) {
        val request = gson.fromJson<EditorScrollToRequest>(message.params!!)
        project.editorService?.scroll(request.uri, request.position, request.atTop)
    }

    private fun parse(json: String): WebViewMessage {
        val parser = JsonParser()
        val jsonObject = parser.parse(json).asJsonObject

        val id = jsonObject.get("id").nullString
        val method = jsonObject.get("method").string
        val params = jsonObject.get("params")
        val error = jsonObject.get("error").nullString

        return WebViewMessage(id, method, params, error)
    }

    class WebViewMessage(
        val id: String?,
        val method: String,
        val params: JsonElement?,
        val error: String?
    ) {
        val target: String = method.split("/")[0]
    }
}

private val Any?.orEmptyObject: Any?
    get() =
        if (this == null || this is Unit) jsonObject()
        else this

