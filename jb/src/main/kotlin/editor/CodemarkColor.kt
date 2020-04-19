package com.codestream.editor

import com.codestream.protocols.agent.Codemark
import java.awt.Color

val aqua = Color(0x5ABFDC)
val blue = Color(0x3578BA)
val gray = Color(0x7F7F7F)
val green = Color(0x7ABA5D)
val orange = Color(0xF1A340)
val purple = Color(0xB87CDA)
val red = Color(0xD9634F)
val yellow = Color(0xEDD648)

fun Codemark.color(): Color {
    return when(this.color) {
        "aqua" -> aqua
        "blue" -> blue
        "gray" -> gray
        "green" -> green
        "orange" -> orange
        "purple" -> purple
        "red" -> red
        "yellow" -> yellow
        else -> blue
    }
}
