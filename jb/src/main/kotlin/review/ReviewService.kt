package com.codestream.review

import com.codestream.agentService
import com.codestream.protocols.agent.GetAllReviewContentsParams
import com.codestream.protocols.agent.GetLocalReviewContentsParams
import com.codestream.protocols.agent.GetReviewContentsResult
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
import java.lang.reflect.Field
import java.lang.reflect.Method

enum class ReviewDiffSide(val path: String) {
    LEFT("left"),
    RIGHT("right")
}

val REVIEW_DIFF = KeyWithDefaultValue.create("REVIEW_DIFF", false)
val REPO_ID = Key<String>("REPO_ID")
val PATH = Key<String>("PATH")

class ReviewService(private val project: Project) {

    var lastReviewFile: VirtualFile? = null
    private val processorField: Field =
        DiffRequestProcessorEditor::class.java.getDeclaredField("processor").also { it.isAccessible = true }
    private val goToPrevChangeMethod: Method =
        CacheDiffRequestChainProcessor::class.java.getDeclaredMethod("goToPrevChange", Boolean::class.java)
            .also { it.isAccessible = true }
    private val goToNextChangeMethod: Method =
        CacheDiffRequestChainProcessor::class.java.getDeclaredMethod("goToNextChange", Boolean::class.java)
            .also { it.isAccessible = true }
    private var diffChain: DiffRequestChain? = null

    suspend fun showDiff(reviewId: String, repoId: String, path: String) {
        val agent = project.agentService ?: return

        if (reviewDiffEditor == null || diffChain == null) {
            val review = agent.getReview(reviewId)
            val title = review.title
            val contents = agent.getAllReviewContents(GetAllReviewContentsParams(reviewId))

            val diffRequests = contents.repos.flatMap { repo ->
                repo.files.map { file ->
                    val leftContent = createReviewDiffContent(
                        project,
                        review.id,
                        repo.repoId,
                        ReviewDiffSide.LEFT,
                        file.path,
                        file.left
                    )
                    val rightContent = createReviewDiffContent(
                        project,
                        review.id,
                        repo.repoId,
                        ReviewDiffSide.RIGHT,
                        file.path,
                        file.right
                    )
                    SimpleDiffRequest(title, leftContent, rightContent, file.path, file.path).also {
                        it.putUserData(REPO_ID, repo.repoId)
                        it.putUserData(PATH, file.path)
                        it.putUserData(REVIEW_DIFF, true)
                    }
                }
            }

            diffChain = SimpleDiffRequestChain(diffRequests).also { chain ->
                chain.putUserData(REVIEW_DIFF, true)
                chain.index = diffRequests.indexOfFirst { request ->
                    request.getUserData(REPO_ID) == repoId && request.getUserData(PATH) == path
                }
            }

            val registryValue = Registry.get("show.diff.as.editor.tab")
            val original = registryValue.asBoolean()

            ApplicationManager.getApplication().invokeLater {
                try {
                    registryValue.setValue(true)
                    DiffManagerEx.getInstance().showDiffBuiltin(project, diffChain!!, DiffDialogHints.FRAME)
                } finally {
                    registryValue.setValue(original)
                }
            }
        }

        val index = (diffChain!!.requests as List<SimpleDiffRequestChain.DiffRequestProducerWrapper>).indexOfFirst {
            it.request.getUserData(REPO_ID) == repoId && it.request.getUserData(PATH) == path
        }
        ApplicationManager.getApplication().invokeLater {
            val processor = reviewDiffEditor?.let { processorField.get(it) as CacheDiffRequestChainProcessor }
            processor?.setCurrentRequest(index)
        }
    }

    suspend fun showLocalDiff(
        repoId: String,
        path: String,
        includeSaved: Boolean,
        includeStaged: Boolean,
        baseSha: String
    ) {
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
        diffRequest.putUserData(REVIEW_DIFF, true)
        val file = SimpleDiffVirtualFile(diffRequest)
        ApplicationManager.getApplication().invokeLater {
            val manager = FileEditorManager.getInstance(project)
            lastReviewFile?.let { manager.closeFile(it) }
            lastReviewFile = file
            manager.openFile(file, true)
        }
    }

    fun closeDiff() {
        reviewDiffEditor?.let {
            ApplicationManager.getApplication().invokeLater {
                FileEditorManager.getInstance(project).closeFile(it.file)
            }
        }
    }

    fun nextDiff() {
        ApplicationManager.getApplication().invokeLater {
            reviewDiffEditor?.processor?.let { goToNextChangeMethod.invoke(it, true) }
        }
    }

    fun previousDiff() {
        ApplicationManager.getApplication().invokeLater {
            reviewDiffEditor?.processor?.let { goToPrevChangeMethod.invoke(it, true) }
        }
    }

    private val reviewDiffEditor
        get() = FileEditorManager.getInstance(project).allEditors.find {
            it is DiffRequestProcessorEditor
                && (processorField.get(it) as? CacheDiffRequestChainProcessor)?.requestChain?.getUserData(REVIEW_DIFF) == true
        } as DiffRequestProcessorEditor?

    private val DiffRequestProcessorEditor.processor
        get() = processorField.get(this) as CacheDiffRequestChainProcessor
}
