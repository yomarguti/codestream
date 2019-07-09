package com.codestream.agent

import org.eclipse.lsp4j.jsonrpc.services.JsonRequest
import org.eclipse.lsp4j.services.LanguageServer
import protocols.agent.LoginResult
import protocols.agent.LoginWithTokenParams
import protocols.agent.TextDocumentFromKeyParams
import protocols.agent.TextDocumentFromKeyResult
import java.util.concurrent.CompletableFuture

interface CodeStreamLanguageServer : LanguageServer {

    @JsonRequest("codestream/login/token")
    fun loginToken(params: LoginWithTokenParams): CompletableFuture<LoginResult>

    @JsonRequest("codestream/textDocument/fromKey")
    fun textDocumentFromKey(params: TextDocumentFromKeyParams): CompletableFuture<TextDocumentFromKeyResult>
}
