package com.codestream.editor

import com.codestream.ServiceConsumer
import com.intellij.openapi.editor.event.EditorFactoryEvent
import com.intellij.openapi.editor.event.EditorFactoryListener
import com.intellij.openapi.project.Project

class EditorFactoryListenerImpl(val project: Project) : EditorFactoryListener, ServiceConsumer(project) {

    override fun editorCreated(event: EditorFactoryEvent) {
        try {
            if (event.editor.project == project) {
                editorService.add(event.editor)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override fun editorReleased(event: EditorFactoryEvent) {
        try {
            if (event.editor.project == project) {
                editorService.remove(event.editor)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}