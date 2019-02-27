package com.codestream

import com.google.gson.JsonElement
import com.google.gson.JsonObject
import org.eclipse.lsp4j.Position
import org.eclipse.lsp4j.Range
import org.eclipse.lsp4j.ServerCapabilities
import org.eclipse.lsp4j.jsonrpc.services.JsonRequest
import org.eclipse.lsp4j.services.LanguageServer
import java.util.concurrent.CompletableFuture

interface CodeStreamLanguageServer : LanguageServer {

    @JsonRequest("codeStream/login")
    fun login(params: Map<String, Any?>): CompletableFuture<JsonElement>

    @JsonRequest("codeStream/logout")
    fun logout(params: LogoutParams): CompletableFuture<JsonElement>

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

    @JsonRequest("codeStream/textDocument/fromMarker")
    fun documentFromMarker(params: DocumentFromMarkerParams): CompletableFuture<DocumentFromMarkerResult>

    @JsonRequest("codeStream/textDocument/markers")
    fun documentMarkers(params: DocumentMarkersParams): CompletableFuture<DocumentMarkersResult>

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

class LogoutParams

class DocumentFromMarkerParams(
    val file: String,
    val repoId: String,
    val markerId: String
)

class DocumentFromMarkerResult(
    val textDocument: TextDocument?,
    val range: Range?
)

class DocumentMarkersParams(val textDocument: TextDocument)

class DocumentMarkersResult(val markers: List<DocumentMarker>, val markersNotLocated: Any)

class DocumentMarker(
    val codemark: Codemark,
//    creatorName: string;
    val range: Range,
    val summary: String
//    summaryMarkdown: string;
)

class Codemark(
    val type: String,
    val color: String
)

class TextDocument(val uri: String)
