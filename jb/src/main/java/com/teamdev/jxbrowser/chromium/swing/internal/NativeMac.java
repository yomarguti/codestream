//
// Source code recreated from a .class file by IntelliJ IDEA
// (powered by Fernflower decompiler)
//

package com.teamdev.jxbrowser.chromium.swing.internal;

import com.teamdev.jxbrowser.chromium.LoggerProvider;
import com.teamdev.jxbrowser.chromium.internal.Environment;
import com.teamdev.jxbrowser.chromium.internal.ReflectionUtil;
import java.awt.Component;
import java.awt.Window;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.util.logging.Logger;
import javax.swing.SwingUtilities;

public class NativeMac extends Native {
    private static final Logger a = LoggerProvider.getBrowserLogger();

    public NativeMac() {
    }

    public long getWindowHandle(Component component) {
        Window component1;
        if ((component1 = SwingUtilities.getWindowAncestor(component)) != null) {
            if (Environment.isJRE6()) {
                return (Long)ReflectionUtil.invokeMethod(a(component1), "getViewPtr");
            }

            Object component2;
            String var2 = (component2 = ReflectionUtil.invokeMethod(a(component1), "getPlatformWindow")).getClass().getName();
            a.info("Get native window handle from " + var2);
            if (var2.endsWith("CPlatformWindow")) {
                return (Long)ReflectionUtil.invokeMethod(ReflectionUtil.invokeMethod(component2, "getContentView"), "getAWTView");
            }

            if (var2.endsWith("CViewPlatformEmbeddedFrame")) {
                return (Long)ReflectionUtil.invokeMethod(component2, "getNSViewPtr");
            }

            a.warning("Failed to get native window handle. Unsupported container: " + var2);
        }

        return 0L;
    }

    private static Object a(Window var0) {
        try {
            Field field = ReflectionUtil.findFieldByName(var0.getClass(), "peer");
            field.setAccessible(true);
            Object value = field.get(var0);
            field.setAccessible(false);
            return value;
        } catch (IllegalAccessException var1) {
            throw new RuntimeException(var1);
        }
    }
}
