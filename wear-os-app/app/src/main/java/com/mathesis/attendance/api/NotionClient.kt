package com.mathesis.attendance.api

import com.google.gson.Gson
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.mathesis.attendance.data.Student
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.TimeUnit

class NotionClient(
    private val apiKey: String,
    private val databaseId: String
) {
    private val api: NotionApi

    init {
        val client = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build()

        val retrofit = Retrofit.Builder()
            .baseUrl("https://api.notion.com/v1/")
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()

        api = retrofit.create(NotionApi::class.java)
    }

    private val authorization get() = "Bearer $apiKey"

    suspend fun getTodayStudents(): Result<List<Student>> = getStudentsByDay(getTodayDayKorean())

    suspend fun getStudentsByDay(day: String): Result<List<Student>> = withContext(Dispatchers.IO) {
        try {
            val response = api.queryDatabase(databaseId, authorization)

            if (!response.isSuccessful) {
                return@withContext Result.failure(
                    Exception("API Error: ${response.code()} - ${response.errorBody()?.string()}")
                )
            }

            val body = response.body() ?: return@withContext Result.failure(
                Exception("Empty response")
            )

            val results = body.getAsJsonArray("results") ?: JsonArray()
            val students = mutableListOf<Student>()

            for (result in results) {
                val obj = result.asJsonObject
                val properties = obj.getAsJsonObject("properties")

                val student = parseStudent(obj.get("id").asString, properties)
                if (student != null && student.day.contains(day)) {
                    students.add(student)
                }
            }

            // Sort by start time
            students.sortBy { it.startTime }

            Result.success(students)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun parseStudent(id: String, properties: JsonObject): Student? {
        try {
            val name = getTitle(properties, "이름") ?: return null
            val grade = getRichText(properties, "학년") ?: ""
            val subject = getRichText(properties, "과목") ?: ""
            val day = getRichText(properties, "요일") ?: ""
            val startTimeNum = getNumber(properties, "시작시간")
            val endTime = getRichText(properties, "종료시간") ?: ""

            val startTime = numberToTime(startTimeNum)

            return Student(
                id = id,
                name = name,
                grade = grade,
                subject = subject,
                day = day,
                startTime = startTime,
                endTime = endTime
            )
        } catch (e: Exception) {
            return null
        }
    }

    private fun getTitle(properties: JsonObject, key: String): String? {
        return try {
            properties.getAsJsonObject(key)
                ?.getAsJsonArray("title")
                ?.get(0)?.asJsonObject
                ?.get("plain_text")?.asString
        } catch (e: Exception) { null }
    }

    private fun getRichText(properties: JsonObject, key: String): String? {
        return try {
            val richText = properties.getAsJsonObject(key)
                ?.getAsJsonArray("rich_text")
            if (richText != null && richText.size() > 0) {
                richText.get(0).asJsonObject.get("plain_text").asString
            } else null
        } catch (e: Exception) { null }
    }

    private fun getNumber(properties: JsonObject, key: String): Int? {
        return try {
            val numObj = properties.getAsJsonObject(key)
            if (numObj?.get("number")?.isJsonNull == false) {
                numObj.get("number").asInt
            } else null
        } catch (e: Exception) { null }
    }

    private fun numberToTime(num: Int?): String {
        if (num == null) return "00:00"
        val hours = num / 100
        val minutes = num % 100
        return String.format("%02d:%02d", hours, minutes)
    }

    private fun getTodayDayKorean(): String {
        val calendar = Calendar.getInstance()
        return when (calendar.get(Calendar.DAY_OF_WEEK)) {
            Calendar.MONDAY -> "월"
            Calendar.TUESDAY -> "화"
            Calendar.WEDNESDAY -> "수"
            Calendar.THURSDAY -> "목"
            Calendar.FRIDAY -> "금"
            Calendar.SATURDAY -> "토"
            Calendar.SUNDAY -> "일"
            else -> ""
        }
    }

    suspend fun recordCheckIn(studentId: String): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val now = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault())
                .format(Date())

            val properties = JsonObject().apply {
                add("출석시간", JsonObject().apply {
                    add("rich_text", JsonArray().apply {
                        add(JsonObject().apply {
                            addProperty("text", JsonObject().apply {
                                addProperty("content", now)
                            }.toString())
                            add("text", JsonObject().apply {
                                addProperty("content", now)
                            })
                        })
                    })
                })
            }

            val body = JsonObject().apply {
                add("properties", properties)
            }

            val response = api.updatePage(studentId, authorization, properties = body)
            Result.success(response.isSuccessful)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun recordCheckOut(studentId: String): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val now = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault())
                .format(Date())

            val properties = JsonObject().apply {
                add("퇴실시간", JsonObject().apply {
                    add("rich_text", JsonArray().apply {
                        add(JsonObject().apply {
                            add("text", JsonObject().apply {
                                addProperty("content", now)
                            })
                        })
                    })
                })
            }

            val body = JsonObject().apply {
                add("properties", properties)
            }

            val response = api.updatePage(studentId, authorization, properties = body)
            Result.success(response.isSuccessful)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
