package com.codestream

import com.google.gson.JsonElement
import org.eclipse.lsp4j.MessageActionItem
import org.eclipse.lsp4j.MessageParams
import org.eclipse.lsp4j.PublishDiagnosticsParams
import org.eclipse.lsp4j.ShowMessageRequestParams
import org.eclipse.lsp4j.jsonrpc.services.JsonNotification
import org.eclipse.lsp4j.services.LanguageClient
import java.util.concurrent.CompletableFuture

class CodeStreamLanguageClient(val webViewService: WebViewService) : LanguageClient {



    @JsonNotification("codeStream/didChangeData")
    fun didChangeData(json: JsonElement) {
        webViewService.postMessage(Ipc.toDataMessage(json))
    }


    override fun showMessageRequest(requestParams: ShowMessageRequestParams?): CompletableFuture<MessageActionItem> {
        TODO("not implemented") //To change body of created functions use File | Settings | File Templates.
    }

    override fun telemetryEvent(`object`: Any?) {
        TODO("not implemented") //To change body of created functions use File | Settings | File Templates.
    }

    override fun logMessage(message: MessageParams?) {
        TODO("not implemented") //To change body of created functions use File | Settings | File Templates.
    }

    override fun showMessage(messageParams: MessageParams?) {
        TODO("not implemented") //To change body of created functions use File | Settings | File Templates.
    }

    override fun publishDiagnostics(diagnostics: PublishDiagnosticsParams?) {
        TODO("not implemented") //To change body of created functions use File | Settings | File Templates.
    }

}