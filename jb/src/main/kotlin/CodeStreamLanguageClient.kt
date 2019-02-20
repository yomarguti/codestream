package com.codestream

import com.google.gson.JsonElement
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import org.eclipse.lsp4j.*
import org.eclipse.lsp4j.jsonrpc.services.JsonNotification
import org.eclipse.lsp4j.services.LanguageClient
import java.util.concurrent.CompletableFuture

class CodeStreamLanguageClient(private val project: Project) : LanguageClient {

    private val logger = Logger.getInstance(CodeStreamLanguageClient::class.java)

    private val webViewService: WebViewService by lazy {
        ServiceManager.getService(project, WebViewService::class.java)
    }


    @JsonNotification("codeStream/didChangeData")
    fun didChangeData(json: JsonElement) {
        webViewService.postMessage(Ipc.toDataMessage(json))
    }

    @JsonNotification("codeStream/didChangeConnectionStatus")
    fun didChangeConnectionStatus(json: JsonElement) {
        webViewService.postMessage(Ipc.toDataMessage(json))
    }

    @JsonNotification("codeStream/didLogout")
    fun didLogout(json: JsonElement) {
        webViewService.postMessage(Ipc.toDataMessage(json))
    }

    override fun registerCapability(params: RegistrationParams): CompletableFuture<Void> {
        params.registrations.forEach {
            println("LSP server wants to register ${it.method}")
        }
        return CompletableFuture.completedFuture(null)
    }

    override fun showMessageRequest(requestParams: ShowMessageRequestParams?): CompletableFuture<MessageActionItem> {
        TODO("not implemented") //To change body of created functions use File | Settings | File Templates.
    }

    override fun telemetryEvent(`object`: Any?) {
        TODO("not implemented") //To change body of created functions use File | Settings | File Templates.
    }

    override fun logMessage(message: MessageParams?) {
        logger.info(message.toString())
    }

    override fun showMessage(messageParams: MessageParams?) {
        TODO("not implemented") //To change body of created functions use File | Settings | File Templates.
    }

    override fun publishDiagnostics(diagnostics: PublishDiagnosticsParams?) {
        TODO("not implemented") //To change body of created functions use File | Settings | File Templates.
    }

}