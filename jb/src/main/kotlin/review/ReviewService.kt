package com.codestream.review

import com.codestream.agentService
import com.intellij.diff.editor.SimpleDiffVirtualFile
import com.intellij.diff.requests.SimpleDiffRequest
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.KeyWithDefaultValue
import com.intellij.openapi.vfs.VirtualFile
import protocols.agent.GetReviewContentsParams

enum class ReviewDiffSide(val path: String) {
    LEFT("left"),
    RIGHT("right")
}

val REVIEW_DIFF_REQUEST = KeyWithDefaultValue.create("REVIEW_DIFF_REQUEST", false)

class ReviewService(private val project: Project) {

    var lastReviewFile: VirtualFile? = null

    suspend fun showDiff(reviewId: String, repoId: String, path: String) {
        val agent = project.agentService ?: return

        val review = agent.getReview(reviewId)
        val contents = agent.getRevieweContents(GetReviewContentsParams(reviewId, repoId, path))
        val leftContent = createReviewDiffContent(project, reviewId, repoId, ReviewDiffSide.LEFT, path, contents.left)
        val rightContent = createReviewDiffContent(project, reviewId, repoId, ReviewDiffSide.RIGHT, path, contents.right)
        val diffRequest = SimpleDiffRequest(review.title, leftContent, rightContent, path, path)
        diffRequest.putUserData(REVIEW_DIFF_REQUEST, true)
        val file = SimpleDiffVirtualFile(diffRequest)
        ApplicationManager.getApplication().invokeLater {
            val manager = FileEditorManager.getInstance(project)
            lastReviewFile?.let { manager.closeFile(it) }
            lastReviewFile = file
            manager.openFile(file, true)
        }
    }
}
