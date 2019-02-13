package com.codestream

class Ipc {

    companion object {
        fun toResponseMessage(id: String, payload: Any, error: String?): String
        {
            return toResponseMessage(id, payload.toString(), error)
        }

        private fun toResponseMessage(id: String, payload: String, error: String?): String
        {
            val type = "codestream:response"

//            payload = GetPayload(payload);

//            if (error.IsNullOrWhiteSpace())
//            {
//                return @"{""type"":""" + type + @""",""body"":{""id"": """ + id + @""",""payload"":" + payload + @"}}";
//            }
//            else
//            {
//                if (payload.IsNullOrWhiteSpace())
//                {
//                    return @"{""type"":""" + type + @""",""body"":{""id"":""" + id + @""",""error"":""" + error + @"""}}";
//                }
//
//                return @"{""type"":""" + type + @""",""body"":{""id"":""" + id + @""",""payload"":" + payload + @",""error"":""" + error + @"""}}";
//            }

            return "{\"type\":\"$type\",\"body\":{\"id\":\"$id\",\"payload\":$payload,\"error\":null}}"
        }
    }

}