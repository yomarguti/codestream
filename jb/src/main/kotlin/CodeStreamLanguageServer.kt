package com.codestream

import com.google.gson.JsonElement
import com.google.gson.JsonObject
import org.eclipse.lsp4j.Range
import org.eclipse.lsp4j.TextDocumentIdentifier
import org.eclipse.lsp4j.jsonrpc.services.JsonRequest
import org.eclipse.lsp4j.services.LanguageServer
import protocols.agent.*
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

class TextDocumentFromKeyParams(val key: Int)

class TextDocumentFromKeyResult(
    val textDocument: TextDocumentIdentifier,
    val range: Range,
    val marker: JsonObject
)

class Codemark(
    val id: String,
    val type: String?,
    val color: String?,
    val streamId: String,
    val postId: String?
)

class TextDocument(val uri: String)
