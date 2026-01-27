package com.mathesis.attendance.util

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "settings")

class PreferencesManager(private val context: Context) {

    companion object {
        private val API_KEY = stringPreferencesKey("notion_api_key")
        private val DATABASE_ID = stringPreferencesKey("notion_database_id")

        // 테스트용 하드코딩 값 (실제 사용 시 여기에 입력)
        private const val HARDCODED_API_KEY = "YOUR_NOTION_API_KEY_HERE"
        private const val HARDCODED_DATABASE_ID = "YOUR_DATABASE_ID_HERE"
    }

    val apiKey: Flow<String> = context.dataStore.data.map { preferences ->
        preferences[API_KEY] ?: ""
    }

    val databaseId: Flow<String> = context.dataStore.data.map { preferences ->
        preferences[DATABASE_ID] ?: ""
    }

    suspend fun getApiKey(): String {
        // 테스트용 하드코딩 사용
        return HARDCODED_API_KEY
        // return context.dataStore.data.first()[API_KEY] ?: ""
    }

    suspend fun getDatabaseId(): String {
        // 테스트용 하드코딩 사용
        return HARDCODED_DATABASE_ID
        // return context.dataStore.data.first()[DATABASE_ID] ?: ""
    }

    suspend fun saveApiKey(apiKey: String) {
        context.dataStore.edit { preferences ->
            preferences[API_KEY] = apiKey
        }
    }

    suspend fun saveDatabaseId(databaseId: String) {
        context.dataStore.edit { preferences ->
            preferences[DATABASE_ID] = databaseId
        }
    }

    suspend fun isConfigured(): Boolean {
        // 테스트용 하드코딩 사용 시 항상 true
        return true
        // val key = getApiKey()
        // val dbId = getDatabaseId()
        // return key.isNotBlank() && dbId.isNotBlank()
    }
}
