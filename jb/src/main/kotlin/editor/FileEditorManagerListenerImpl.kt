package com.codestream.editor

import com.codestream.ServiceConsumer
import com.intellij.openapi.fileEditor.FileEditorManagerEvent
import com.intellij.openapi.fileEditor.FileEditorManagerListener
import com.intellij.openapi.project.Project

class FileEditorManagerListenerImpl(project: Project) : FileEditorManagerListener, ServiceConsumer(project) {

    override fun selectionChanged(event: FileEditorManagerEvent) {
        editorService.setActiveEditor(event.newEditor)
    }

}
