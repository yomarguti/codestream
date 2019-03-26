package com.codestream

import com.codestream.editor.uri
import com.intellij.openapi.module.Module
import com.intellij.openapi.module.impl.scopes.ModuleWithDependenciesScope
import com.intellij.openapi.project.ModuleListener
import com.intellij.openapi.project.Project
import org.eclipse.lsp4j.DidChangeWorkspaceFoldersParams
import org.eclipse.lsp4j.WorkspaceFolder
import org.eclipse.lsp4j.WorkspaceFoldersChangeEvent

class ModuleListenerImpl(project: Project) : ServiceConsumer(project), ModuleListener {

    override fun moduleAdded(project: Project, module: Module) {
        val roots = (module.moduleContentScope as? ModuleWithDependenciesScope)?.roots ?: return
        val folders = roots.map { WorkspaceFolder(it.uri) }
        agentService.agent.workspaceService.didChangeWorkspaceFolders(
            DidChangeWorkspaceFoldersParams(
                WorkspaceFoldersChangeEvent(
                    folders.toMutableList(),
                    mutableListOf()
                )
            )
        )
    }

    override fun moduleRemoved(project: Project, module: Module) {
        val roots = (module.moduleContentScope as? ModuleWithDependenciesScope)?.roots ?: return
        val folders = roots.map { WorkspaceFolder(it.uri) }
        agentService.agent.workspaceService.didChangeWorkspaceFolders(
            DidChangeWorkspaceFoldersParams(
                WorkspaceFoldersChangeEvent(
                    mutableListOf(),
                    folders.toMutableList()
                )
            )
        )
    }

}