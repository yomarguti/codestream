package com.codestream

import com.google.gson.JsonElement
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
//
//    @JsonRequest("codeStream/textDocument/fromMarker")
//    fun documentFromMarker(params: DocumentFromMarkerParams): CompletableFuture<DocumentFromMarkerResult>
//
//    @JsonRequest("codestream/textDocument/markers")
//    fun documentMarkers(params: DocumentMarkersParams): CompletableFuture<DocumentMarkersResult>
//
//    @JsonRequest("codeStream/post/prepareWithCode")
//    fun preparePostWithCode(params: PreparePostWithCodeParams): CompletableFuture<PreparePostWithCodeResult>

}

class DocumentFromMarkerParams(
    val file: String,
    val repoId: String,
    val markerId: String
)

class DocumentFromMarkerResult(
    val textDocument: TextDocument?,
    val range: Range?
)

class PreparePostWithCodeParams(
    val textDocument: TextDocumentIdentifier,
    val range: Range,
    val dirty: Boolean
)

class PreparePostWithCodeResult(
    val code: String,
    val range: Range,
    val source: CodeBlockSource?,
    val gitError: String?
)

class CodeBlockSource(
    val file: String,
    val repoPath: String,
    val revision: String,
    val authors: JsonElement,
    val remotes: JsonElement
)

class Codemark(
    val id: String,
    val type: String,
    val color: String?,
    val streamId: String,
    val postId: String?
)

class TextDocument(val uri: String)
