package com.codestream

import org.eclipse.lsp4j.ServerCapabilities
import org.eclipse.lsp4j.jsonrpc.services.JsonRequest
import org.eclipse.lsp4j.services.LanguageServer
import java.util.concurrent.CompletableFuture

interface CodeStreamLanguageServer : LanguageServer {

    @JsonRequest("codeStream/login")
    fun login(params: Map<String, Any>): CompletableFuture<LoginResult>

    @JsonRequest("codeStream/repos")
    fun fetchRepos(params: FetchReposParams): CompletableFuture<FetchReposResult>

    @JsonRequest("codeStream/streams")
    fun fetchStreams(params: FetchStreamsParams): CompletableFuture<FetchStreamsResult>

    @JsonRequest("codeStream/users")
    fun fetchUsers(params: FetchUsersParams): CompletableFuture<FetchUsersResult>

    @JsonRequest("codeStream/teams")
    fun fetchTeams(params: FetchTeamsParams): CompletableFuture<FetchTeamsResult>

    @JsonRequest("codeStream/users/me/unreads")
    fun getUnreads(params: GetUnreadsParams): CompletableFuture<GetUnreadsResult>

    @JsonRequest("codeStream/users/me/preferences")
    fun getPreferences(params: GetPreferencesParams): CompletableFuture<GetPreferencesResult>

}


class GetPreferencesParams

class GetPreferencesResult {
    val preferences: Map<String, Any>? = null
}

class GetUnreadsParams

class GetUnreadsResult {
    val unreads: Map<String, Any>? = null
}

class FetchReposResult {
    val repos: Array<Any>? = null
}

class FetchReposParams

class FetchStreamsResult {
    val streams: Array<Any>? = null
}

class FetchStreamsParams

class FetchTeamsResult {
    val teams: Array<Any>? = null
}

class FetchTeamsParams

class FetchUsersResult {
    val users: Array<Any>? = null
}

class FetchUsersParams

class LoginResult {
    var capabilities: ServerCapabilities? = null
    var result: Map<String, Object>? = null
}

class LoginParams(val email: String?, val password: String?)

