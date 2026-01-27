package com.mathesis.attendance.api

import com.google.gson.JsonObject
import retrofit2.Response
import retrofit2.http.*

interface NotionApi {

    @POST("databases/{databaseId}/query")
    suspend fun queryDatabase(
        @Path("databaseId") databaseId: String,
        @Header("Authorization") authorization: String,
        @Header("Notion-Version") notionVersion: String = "2022-06-28",
        @Body body: JsonObject = JsonObject()
    ): Response<JsonObject>

    @PATCH("pages/{pageId}")
    suspend fun updatePage(
        @Path("pageId") pageId: String,
        @Header("Authorization") authorization: String,
        @Header("Notion-Version") notionVersion: String = "2022-06-28",
        @Body properties: JsonObject
    ): Response<JsonObject>

    @POST("pages")
    suspend fun createPage(
        @Header("Authorization") authorization: String,
        @Header("Notion-Version") notionVersion: String = "2022-06-28",
        @Body body: JsonObject
    ): Response<JsonObject>
}
