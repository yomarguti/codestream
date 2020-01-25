package com.codestream.workaround;

import com.intellij.openapi.project.Project;
import com.intellij.openapi.wm.ToolWindowManager;

/**
 * https://youtrack.jetbrains.com/issue/IDEA-231429
 */
public class ToolWindowManagerWorkaround {

    public static ToolWindowManager getInstance(Project project) {
        return ToolWindowManager.getInstance(project);
    }

}
