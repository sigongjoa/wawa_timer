package com.mathesis.attendance.ui

import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.lifecycle.lifecycleScope
import com.mathesis.attendance.databinding.ActivitySettingsBinding
import com.mathesis.attendance.util.PreferencesManager
import kotlinx.coroutines.launch

class SettingsActivity : ComponentActivity() {

    private lateinit var binding: ActivitySettingsBinding
    private lateinit var preferencesManager: PreferencesManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        preferencesManager = PreferencesManager(this)

        loadSettings()
        setupSaveButton()
    }

    private fun loadSettings() {
        lifecycleScope.launch {
            binding.apiKeyInput.setText(preferencesManager.getApiKey())
            binding.dbIdInput.setText(preferencesManager.getDatabaseId())
        }
    }

    private fun setupSaveButton() {
        binding.saveButton.setOnClickListener {
            val apiKey = binding.apiKeyInput.text.toString().trim()
            val dbId = binding.dbIdInput.text.toString().trim()

            if (apiKey.isEmpty() || dbId.isEmpty()) {
                Toast.makeText(this, "모든 필드를 입력하세요", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            lifecycleScope.launch {
                preferencesManager.saveApiKey(apiKey)
                preferencesManager.saveDatabaseId(dbId)
                Toast.makeText(this@SettingsActivity, "저장됨", Toast.LENGTH_SHORT).show()
                finish()
            }
        }
    }
}
