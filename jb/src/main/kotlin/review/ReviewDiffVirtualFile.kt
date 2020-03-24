package com.codestream.review

import com.intellij.openapi.vfs.VirtualFileSystem
import com.intellij.testFramework.LightVirtualFile

class ReviewDiffVirtualFile : LightVirtualFile {
    private val myFullPath: String
    private val mySide: ReviewDiffSide

    private constructor(fullPath: String, side: ReviewDiffSide, path: String, content: String) : super(path, content) {
        myFullPath = fullPath
        mySide = side
    }

    companion object {
        fun create(reviewId: String, repoId: String, side: ReviewDiffSide, path: String, content: String) : ReviewDiffVirtualFile {
            val fullPath = "$reviewId/$repoId/${side.path}/$path"
            return ReviewDiffVirtualFile(fullPath, side, path, content)
        }
    }

    val side: ReviewDiffSide get() = mySide

    override fun getFileSystem(): VirtualFileSystem {
        return ReviewDiffFileSystem
    }

    override fun getPath(): String {
        return myFullPath
    }

    override fun toString(): String {
        return "ReviewDiffVirtualFile: $name"
    }
}
