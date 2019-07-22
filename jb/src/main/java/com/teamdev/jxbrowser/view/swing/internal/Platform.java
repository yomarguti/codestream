//
// Source code recreated from a .class file by IntelliJ IDEA
// (powered by Fernflower decompiler)
//

package com.teamdev.jxbrowser.view.swing.internal;

import com.teamdev.jxbrowser.os.Environment;
import com.teamdev.jxbrowser.view.swing.internal.java8.platform.PlatformImplMac;
import com.teamdev.jxbrowser.view.swing.internal.java9.PlatformImpl;
import java.awt.Image;

public abstract class Platform {
    private static volatile Platform instance;

    public Platform() {
    }

    public static Platform getInstance() {
        if (instance == null) {
            Class var0 = Platform.class;
            synchronized(Platform.class) {
                if (instance == null) {
                    instance = newInstance();
                }
            }
        }

        return instance;
    }

    private static Platform newInstance() {
        Object result;
        if (System.getProperty("java.vendor").toLowerCase().contains("jetbrains")) {
            result = new PlatformImpl();
        } else if (!Environment.isJre8()) {
            result = new PlatformImpl();
        } else if (Environment.isMac()) {
            result = new PlatformImplMac();
        } else {
            result = new com.teamdev.jxbrowser.view.swing.internal.java8.PlatformImpl();
        }

        return (Platform)result;
    }

    public abstract boolean isDpiAware();

    public abstract Image createMultiResolutionImage(Image var1, Image var2);
}
