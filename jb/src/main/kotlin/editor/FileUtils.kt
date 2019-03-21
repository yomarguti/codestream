package com.codestream.editor

import com.intellij.openapi.vfs.VirtualFile
import java.net.URL


enum class OS {
    WINDOWS, UNIX
}

val os: OS by lazy {
    if (System.getProperty("os.name").toLowerCase().contains("win"))
        OS.WINDOWS
    else
        OS.UNIX
}


const val SPACE_ENCODED: String = "%20"
const val COLON_ENCODED: String = "%3A"
const val URI_FILE_BEGIN = "file:"
const val URI_PATH_SEP: Char = '/'
const val URI_VALID_FILE_BEGIN: String = "file:///"

val VirtualFile.uri: String?
    get() {
        return try {
            sanitizeURI(URL(url.replace(" ", SPACE_ENCODED)).toURI().toString())
        } catch (e: Exception) {
            // LOG.warn(e)
            null
        }
    }

fun sanitizeURI(uri: String?): String? {
    if (uri == null) {
        return null
    }

    if (!uri.startsWith(URI_FILE_BEGIN)) {
//        LOG.warn("Malformed uri : " + uri)
        return uri // Probably not an uri
    } else {
        val reconstructed = StringBuilder()
        var uriCp = uri.replace(" ", SPACE_ENCODED) // Don't trust servers
        uriCp = uriCp.drop(URI_FILE_BEGIN.length).dropWhile { c -> c == URI_PATH_SEP }
        reconstructed.append(URI_VALID_FILE_BEGIN)

        return if (os == OS.UNIX) {
            reconstructed.append(uriCp).toString()
        } else {
            reconstructed.append(uriCp.takeWhile { c -> c != URI_PATH_SEP })
            val driveLetter = reconstructed[URI_VALID_FILE_BEGIN.length]
            if (driveLetter.isLowerCase()) {
                reconstructed.setCharAt(URI_VALID_FILE_BEGIN.length, driveLetter.toUpperCase())
            }
            if (reconstructed.endsWith(COLON_ENCODED)) {
                reconstructed.delete(reconstructed.length - 3, reconstructed.length)
            }
            if (!reconstructed.endsWith(":")) {
                reconstructed.append(":")
            }
            reconstructed.append(uriCp.dropWhile { c -> c != URI_PATH_SEP }).toString()
        }
    }
}

