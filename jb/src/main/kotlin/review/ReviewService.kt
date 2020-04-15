package com.codestream.review

import com.codestream.agentService
import com.intellij.diff.DiffDialogHints
import com.intellij.diff.DiffManagerEx
import com.intellij.diff.chains.DiffRequestChain
import com.intellij.diff.chains.SimpleDiffRequestChain
import com.intellij.diff.editor.DiffRequestProcessorEditor
import com.intellij.diff.editor.SimpleDiffVirtualFile
import com.intellij.diff.impl.CacheDiffRequestChainProcessor
import com.intellij.diff.requests.SimpleDiffRequest
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Key
import com.intellij.openapi.util.KeyWithDefaultValue
import com.intellij.openapi.util.registry.Registry
import com.intellij.openapi.vfs.VirtualFile
import protocols.agent.GetAllReviewContentsParams
import protocols.agent.GetLocalReviewContentsParams
import protocols.agent.GetReviewContentsResult

enum class ReviewDiffSide(val path: String) {
    LEFT("left"),
    RIGHT("right")
}

val REVIEW_DIFF_REQUEST = KeyWithDefaultValue.create("REVIEW_DIFF_REQUEST", false)
val REPO_ID = Key<String>("repoId")
val PATH = Key<String>("PATH")

class ReviewService(private val project: Project) {

    var lastReviewFile: VirtualFile? = null
    private val diffChains = mutableMapOf<String, DiffRequestChain>()

    suspend fun showDiff(reviewId: String, repoId: String, path: String) {
        val agent = project.agentService ?: return

        val processorField = DiffRequestProcessorEditor::class.java.getDeclaredField("processor")
        processorField.isAccessible = true
        var diffRequestProcessorEditor = FileEditorManager.getInstance(project).allEditors.find {
            it is DiffRequestProcessorEditor && processorField.get(it) is CacheDiffRequestChainProcessor
        } as DiffRequestProcessorEditor?

        var diffChain = diffChains[reviewId]
        if (diffRequestProcessorEditor == null || diffChain == null) {
            val review = agent.getReview(reviewId)
            val title = review.title
            val contents = agent.getAllReviewContents(GetAllReviewContentsParams(reviewId))

            val diffRequests = contents.repos.flatMap { repo -> repo.files.map { file ->
                val leftContent = createReviewDiffContent(project, review.id, repo.repoId, ReviewDiffSide.LEFT, file.path, file.left)
                val rightContent = createReviewDiffContent(project, review.id, repo.repoId, ReviewDiffSide.RIGHT, file.path, file.right)
                SimpleDiffRequest(title, leftContent, rightContent, file.path, file.path).also {
                    it.putUserData(REPO_ID, repo.repoId)
                    it.putUserData(PATH, file.path)
                    it.putUserData(REVIEW_DIFF_REQUEST, true)
                }
            } }

            diffChain = SimpleDiffRequestChain(diffRequests).also { chain ->
                chain.index = diffRequests.indexOfFirst { request ->
                    request.getUserData(REPO_ID) == repoId && request.getUserData(PATH) == path
                }
            }
            diffChains[reviewId] = diffChain

            val registryValue = Registry.get("show.diff.as.editor.tab")
            val original = registryValue.asBoolean()

            ApplicationManager.getApplication().invokeLater {
                try {
                    registryValue.setValue(true)
                    DiffManagerEx.getInstance().showDiffBuiltin(project, diffChain, DiffDialogHints.FRAME)
                } finally {
                    registryValue.setValue(original)
                }
            }
        }

        val index = (diffChain.requests as List<SimpleDiffRequestChain.DiffRequestProducerWrapper>).indexOfFirst {
            it.request.getUserData(REPO_ID) == repoId && it.request.getUserData(PATH) == path
        }
        ApplicationManager.getApplication().invokeLater {
            diffRequestProcessorEditor = FileEditorManager.getInstance(project).allEditors.find {
                it is DiffRequestProcessorEditor && processorField.get(it) is CacheDiffRequestChainProcessor
            } as DiffRequestProcessorEditor?
            val processor = diffRequestProcessorEditor?.let { processorField.get(it) as CacheDiffRequestChainProcessor }
            processor?.setCurrentRequest(index)
        }
    }


    suspend fun showLocalDiff(repoId: String, path: String, includeSaved: Boolean, includeStaged: Boolean, baseSha: String) {
        val agent = project.agentService ?: return

        val rightVersion = when {
            includeSaved -> "saved"
            includeStaged -> "staged"
            else -> "head"
        }
        val contents = agent.getLocalReviewContents(GetLocalReviewContentsParams(repoId, path, baseSha, rightVersion))
        showDiffContent("local", repoId, path, contents, "New Review")
    }

    private fun showDiffContent(
        reviewId: String,
        repoId: String,
        path: String,
        contents: GetReviewContentsResult,
        title: String
    ) {
        val leftContent = createReviewDiffContent(project, reviewId, repoId, ReviewDiffSide.LEFT, path, contents.left)
        val rightContent =
            createReviewDiffContent(project, reviewId, repoId, ReviewDiffSide.RIGHT, path, contents.right)
        val diffRequest = SimpleDiffRequest(title, leftContent, rightContent, path, path)
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
