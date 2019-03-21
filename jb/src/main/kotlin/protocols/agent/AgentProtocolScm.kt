package protocols.agent

import org.eclipse.lsp4j.Range

interface GetRangeScmInfoRequest {
    val uri: String
    val range: Range
    val dirty: Boolean
    val contents: String?
}

interface Author {
    val id: String
    val username: String
}

interface Remote {
    val name: String
    val url: String
}

interface Scm {
    val file: String
    val repoPath: String
    val revision: String
    val authors: Array<Author>
    val remotes: Array<Remote>
}

interface GetRangeScmInfoResponse {
    val uri: String
    val range: Range
    val contents: String
    val scm: Scm?
    val error: String?
}