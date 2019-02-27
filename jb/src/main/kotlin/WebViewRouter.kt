package com.codestream

import com.github.salomonbrys.kotson.*
import com.google.gson.JsonElement
import com.google.gson.JsonParser
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.fileEditor.OpenFileDescriptor
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.LocalFileSystem
import com.intellij.openapi.vfs.VirtualFile
import kotlinx.coroutines.*
import java.io.File
import java.net.URI

class WebViewRouter(val project: Project) {
    private val logger = Logger.getInstance(WebViewRouter::class.java)

    private val agentService: AgentService
        get() = ServiceManager.getService(project, AgentService::class.java)

    private val authenticationService: AuthenticationService
        get() = ServiceManager.getService(project, AuthenticationService::class.java)

    private val webViewService: WebViewService
        get() = ServiceManager.getService(project, WebViewService::class.java)

    fun handle(rawMessage: String, origin: String) = GlobalScope.launch {
        try {
            val message = parse(rawMessage)
            when (message?.type) {
                "codestream:view-ready" -> Unit
                "codestream:request" -> processRequest(message.body)
                "codestream:interaction:active-panel-changed" -> Unit
                "codestream:interaction:context-state-changed" -> Unit
                "codestream:interaction:changed-active-stream" -> Unit
                "codestream:interaction:thread-selected" -> Unit
                "codestream:interaction:thread-closed" -> Unit
                "codestream:subscription:file-changed" -> Unit
                "codestream:unsubscribe:file-changed" -> Unit
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
                params["email"].nullString,
                params["password"].nullString
            )
            "go-to-signup" -> authenticationService.goToSignup(id)
            "go-to-slack-signin" -> authenticationService.goToSlackSignin(id)
            "validate-signup" -> authenticationService.validateSignup(id, params?.asString)
            "show-markers" -> Unit
            "open-comment-on-select" -> Unit
            "mute-all" -> Unit
            "show-code" -> showCode(id, params)
            "sign-out" -> authenticationService.signout()
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

    private suspend fun showCode(id: String, params: JsonElement) {
        val marker = params["marker"]
        val file = marker["file"].string
        val repoId = marker["repoId"].string
        val id = marker["id"].string
//        val source = params.obj.get("source").nullString


        val result = agentService.getDocumentFromMarker(file, repoId, id)
        // TODO sanitize uri
        val virtualFile = LocalFileSystem.getInstance().findFileByIoFile(File(URI(result.textDocument?.uri)))
        if (virtualFile != null) {
            ApplicationManager.getApplication().invokeLater {
                val editorManager = FileEditorManager.getInstance(project)
                val line = result.range?.start?.line ?: 0
                editorManager.openTextEditor(OpenFileDescriptor(project, virtualFile, line, 0), true)
//                val editor = editorManager.openFile(virtualFile, true, true)[0]
//                editor.
                webViewService.postResponse(id, "SUCCESS")
//                SUCCESS,
//                FILE_NOT_FOUND,
//                REPO_NOT_IN_WORKSPACE
            }
        } else {
            webViewService.postResponse(id, "FILE_NOT_FOUND")
        }


//        println(result.textDocument?.uri)
//        println(result.range)


//        var showCodeResponse = message.Params.ToObject<ShowCodeResponse>();
//
//        var fromMarkerResponse = await _codeStreamAgent.GetDocumentFromMarkerAsync(
//                new DocumentFromMarkerRequest
//                        {
//                            File = showCodeResponse.Marker.File,
//                            RepoId = showCodeResponse.Marker.RepoId,
//                            MarkerId = showCodeResponse.Marker.Id,
//                            Source = showCodeResponse.Source
//                        });
//
//        if (fromMarkerResponse?.TextDocument?.Uri != null)
//        {
//            var ideService = Package.GetGlobalService(typeof(SIdeService)) as IIdeService;
//            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(CancellationToken.None);
//            if (ideService != null)
//            {
//                var editorResponse = ideService.OpenEditor(
//                    fromMarkerResponse.TextDocument.Uri.ToUri(),
//                    fromMarkerResponse.Range?.Start?.Line + 1);
//
//                _browserService.PostMessage(Ipc.ToResponseMessage(message.Id, editorResponse.ToString()));
//            }
//        }
    }


    class WebViewMessage(val type: String, val body: JsonElement?)

}

