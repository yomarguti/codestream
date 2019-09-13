package com.codestream.extensions

import com.codestream.system.HASH_ENCODED
import com.codestream.system.SPACE_ENCODED
import com.codestream.system.sanitizeURI
import com.intellij.openapi.module.ModuleManager
import com.intellij.openapi.module.impl.scopes.ModuleWithDependenciesScope
import com.intellij.openapi.project.Project
import org.eclipse.lsp4j.WorkspaceFolder
import java.io.File
import java.net.URL

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

val Project.baseUri: String?
    get() {
        return try {
            val url = "file://" + File(basePath).canonicalPath
            sanitizeURI(
                URL(
                    url
                        .replace(" ", SPACE_ENCODED)
                        .replace("#", HASH_ENCODED)
                ).toURI().toString()
            )
        } catch (e: Exception) {
            // LOG.warn(e)
            null
        }
    }

val Project.projectPaths: Set<String>
    get() {
        var paths = basePath?.let { mutableSetOf(it) } ?: mutableSetOf()
        val moduleManager = getComponent(ModuleManager::class.java)
        for (module in moduleManager.modules) {
            val roots = (module.moduleContentScope as? ModuleWithDependenciesScope)?.roots ?: continue
            val modulePaths = roots.map { it.path }
            paths.addAll(modulePaths)
        }
        return paths
    }

fun Project.intersectsAny(paths: Array<String>): Boolean {
    val projectDirs = projectPaths.map { File(it) }
    val otherDirs = paths.map { File(it) }

    for (projectDir in projectDirs) {
        for (otherDir in otherDirs) {
            if (projectDir.startsWith(otherDir) || otherDir.startsWith(projectDir)) {
                return true
            }
        }
    }

    return false
}
