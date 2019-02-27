package com.codestream

import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.editor.event.EditorFactoryEvent
import com.intellij.openapi.editor.event.EditorFactoryListener
import com.intellij.openapi.project.Project

class EditorFactoryListenerImpl(val project: Project) : EditorFactoryListener {

    private val agentService: AgentService by lazy {
        ServiceManager.getService(project, AgentService::class.java)
    }

    override fun editorReleased(event: EditorFactoryEvent) {
        agentService.disconnect(event.editor)
    }

    override fun editorCreated(event: EditorFactoryEvent) {
        agentService.connect(event.editor)
    }
}