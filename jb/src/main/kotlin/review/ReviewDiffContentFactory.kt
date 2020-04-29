package com.codestream.review

import com.codestream.extensions.file
import com.intellij.codeInsight.daemon.OutsidersPsiFileSupport
import com.intellij.diff.contents.DocumentContent
import com.intellij.diff.contents.DocumentContentImpl
import com.intellij.diff.util.DiffUserDataKeysEx
import com.intellij.openapi.application.ReadAction
import com.intellij.openapi.editor.Document
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.fileTypes.FileTypes
import com.intellij.openapi.fileTypes.PlainTextFileType
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.text.StringUtil
import com.intellij.openapi.vcs.RemoteFilePath
import com.intellij.psi.PsiDocumentManager

fun createReviewDiffContent(project: Project, reviewId: String, repoId: String, side: ReviewDiffSide, path: String, text: String): DocumentContent {
    val fullPath = "$reviewId/$repoId/${side.path}/$path"
    val filePath = RemoteFilePath(fullPath,false)

    val fileType = when (filePath.fileType) {
        FileTypes.UNKNOWN -> PlainTextFileType.INSTANCE
        else -> filePath.fileType
    }
    val separator = StringUtil.detectSeparators(text)
    val correctedText = StringUtil.convertLineSeparators(text)

    val document = ReadAction.compute<Document, RuntimeException> {
        val file = ReviewDiffVirtualFile.create(reviewId, repoId, side, path, correctedText)
        file.isWritable = false
        OutsidersPsiFileSupport.markFile(file, fullPath)
        val document = FileDocumentManager.getInstance().getDocument(file) ?: return@compute null
        PsiDocumentManager.getInstance(project).getPsiFile(document)
        document
    }

    val content: DocumentContent =
        DocumentContentImpl(project, document, fileType, document.file, separator, null, null)
    content.putUserData(DiffUserDataKeysEx.FILE_NAME, filePath.name)

    return content
}

