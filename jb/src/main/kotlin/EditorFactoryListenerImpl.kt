package com.codestream

import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.editor.event.EditorFactoryEvent
import com.intellij.openapi.editor.event.EditorFactoryListener
import com.intellij.openapi.project.Project

class EditorFactoryListenerImpl(val project: Project) : EditorFactoryListener {

    private val editorManagerService: EditorManagerService by lazy {
        ServiceManager.getService(project, EditorManagerService::class.java)
    }

    override fun editorCreated(event: EditorFactoryEvent) {
        if (event.editor.project == project) {
            editorManagerService.add(event.editor)
        }
    }

    override fun editorReleased(event: EditorFactoryEvent) {
        if (event.editor.project == project) {
            editorManagerService.remove(event.editor)
        }
    }
}