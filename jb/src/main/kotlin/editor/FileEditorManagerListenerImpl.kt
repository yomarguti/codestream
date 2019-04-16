package com.codestream.editor

import com.codestream.editorService
import com.intellij.openapi.fileEditor.FileEditorManagerEvent
import com.intellij.openapi.fileEditor.FileEditorManagerListener
import com.intellij.openapi.project.Project

class FileEditorManagerListenerImpl(val project: Project) : FileEditorManagerListener {

    override fun selectionChanged(event: FileEditorManagerEvent) {
        project.editorService?.setActiveEditor(event.newEditor)
    }

}
