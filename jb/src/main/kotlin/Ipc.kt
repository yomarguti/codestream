package com.codestream

import com.github.salomonbrys.kotson.*
import com.google.gson.JsonElement

class Ipc {

    companion object {
        fun toResponseMessage(id: String, payload: Any?, error: String?): String {
            return toResponseMessage(id, payload?.toString(), error)
        }

        private fun toResponseMessage(id: String, payload: String?, error: String?): String {
            val type = "codestream:response"

            error?.apply {
                return "{\"type\":\"$type\",\"body\":{\"id\":\"$id\",\"error\":\"$error\"}}"
            }

            return "{\"type\":\"$type\",\"body\":{\"id\":\"$id\",\"payload\":$payload}}"
        }

//        fun toResponseMessage(id: String, payload: Object?, error: String?): String {
//            return jsonObject(
//                "type" to "codestream:response",
//                "body" to jsonObject(
//                    "id" to id,
//                    "payload" to payload,
//                    "error" to error
//
//                )
//            ).toString()
//        }

        fun toDataMessage(payload: JsonElement): String {
            return "{\"type\":\"codestream:data\",\"body\":$payload}"
        }

    }

}