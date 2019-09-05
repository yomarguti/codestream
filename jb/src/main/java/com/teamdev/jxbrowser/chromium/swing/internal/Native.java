//
// Source code recreated from a .class file by IntelliJ IDEA
// (powered by Fernflower decompiler)
//

package com.teamdev.jxbrowser.chromium.swing.internal;

import com.teamdev.jxbrowser.chromium.internal.Environment;
import java.awt.Component;
import java.awt.event.KeyEvent;
import java.lang.reflect.Field;

public abstract class Native {
    private static Native a = null;

    public Native() {
    }

    public static Native getInstance() {
        if (a == null) {
            if (Environment.isWindows()) {
                a = new NativeWin();
            } else if (Environment.isMac()) {
                a = new NativeMac();
            } else {
                if (!Environment.isLinux()) {
                    throw new IllegalStateException("Unsupported operating system.");
                }

                a = new NativeLinux();
            }
        }

        return a;
    }

    public abstract long getWindowHandle(Component var1);

    public int getNativeKeyCode(KeyEvent event) {
        try {
            Field var2;
            (var2 = event.getClass().getDeclaredField("rawCode")).setAccessible(true);
            int event1 = (int)var2.getLong(event);
            return event1;
        } catch (NoSuchFieldException var3) {
            throw new RuntimeException(var3);
        } catch (IllegalAccessException var4) {
            throw new RuntimeException(var4);
        }
    }

//    public boolean isDpiAware() {
//        return Environment.isMac() || Environment.isWindows();
//    }
    public boolean isDpiAware() {
        return true;
    }
}
