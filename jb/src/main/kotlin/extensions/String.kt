package com.codestream.extensions

fun String?.ifNullOrBlank(defaultValue: () -> String): String =
    if (this.isNullOrBlank()) defaultValue() else this