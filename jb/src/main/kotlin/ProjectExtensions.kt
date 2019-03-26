package com.codestream

import com.codestream.editor.baseUri
import com.codestream.editor.uri
import com.intellij.openapi.module.ModuleManager
import com.intellij.openapi.module.impl.scopes.ModuleWithDependenciesScope
import com.intellij.openapi.project.Project
import org.eclipse.lsp4j.WorkspaceFolder


val Project.workspaceFolders: Set<WorkspaceFolder>
    get() {
        var folders = mutableSetOf(baseWorkspaceFolder)
        val moduleManager = getComponent(ModuleManager::class.java)
        for (module in moduleManager.modules) {
            val roots = (module.moduleContentScope as? ModuleWithDependenciesScope)?.roots ?: continue
            val moduleFolders = roots.map {
                WorkspaceFolder(it.uri)
            }
            folders.addAll(moduleFolders)
        }
        return folders
    }

val Project.baseWorkspaceFolder: WorkspaceFolder
    get() {
        return WorkspaceFolder(baseUri)
    }