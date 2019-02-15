package com.codestream

import com.google.gson.JsonElement

class Ipc {

    companion object {
        fun toResponseMessage(id: String, payload: Any, error: String?): String
        {
            return toResponseMessage(id, payload.toString(), error)
        }

        private fun toResponseMessage(id: String, payload: String, error: String?): String
        {
            val type = "codestream:response"
            return "{\"type\":\"$type\",\"body\":{\"id\":\"$id\",\"payload\":$payload,\"error\":null}}"
        }

        fun toDataMessage(payload: JsonElement): String {
            return "{\"type\":\"codestream:data\",\"body\":${payload.toString()}}"
        }

    }



}