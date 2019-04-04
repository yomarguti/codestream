package com.teamdev.jxbrowser.chromium.swing.internal;

import com.teamdev.jxbrowser.chromium.internal.ReflectionUtil;

import java.awt.*;
import java.lang.reflect.Field;

public class NativeWin extends Native {
    public NativeWin() {
    }

    public long getWindowHandle(Component component) {
        if (component == null) {
            return 0L;
        } else {
            try {
                Class var2 = Class.forName("sun.awt.windows.WComponentPeer");

                for(Object component1 = component; component1 != null; component1 = ((Component)component1).getParent()) {
                    Field field = ReflectionUtil.findFieldByName(component1.getClass(), "peer");
                    if (field != null) {
                        field.setAccessible(true);
                        Object var3 = field.get(component1);
                        field.setAccessible(false);
                        if (var2.isInstance(var3)) {
                            return (Long)ReflectionUtil.invokeMethod(var3, "getHWnd");
                        }
                    }
                    // Object var3 = component1.getClass().getMethod("getPeer").invoke(component1);
                }

                return 0L;
            } catch (IllegalAccessException var5) {
                throw new RuntimeException(var5);
            } catch (ClassNotFoundException var7) {
                throw new RuntimeException(var7);
            }
        }
    }
}