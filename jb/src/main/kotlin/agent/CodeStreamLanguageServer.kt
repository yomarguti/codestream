package com.codestream.agent

import com.google.gson.JsonElement
import org.eclipse.lsp4j.jsonrpc.services.JsonRequest
import org.eclipse.lsp4j.services.LanguageServer
import protocols.agent.BootstrapParams
import protocols.agent.LoginParams
import protocols.agent.LoginResult
import protocols.agent.LogoutParams
import protocols.agent.TextDocumentFromKeyParams
import protocols.agent.TextDocumentFromKeyResult
import java.util.concurrent.CompletableFuture

interface CodeStreamLanguageServer : LanguageServer {

    @JsonRequest("codestream/login")
    fun login(params: LoginParams): CompletableFuture<LoginResult>

    @JsonRequest("codestream/bootstrap")
    fun bootstrap(params: BootstrapParams): CompletableFuture<JsonElement>

    @JsonRequest("codestream/logout")
    fun logout(params: LogoutParams): CompletableFuture<JsonElement>

    @JsonRequest("codestream/textDocument/fromKey")
    fun textDocumentFromKey(params: TextDocumentFromKeyParams): CompletableFuture<TextDocumentFromKeyResult>
}
