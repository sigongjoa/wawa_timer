package com.mathesis.attendance.ui

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import androidx.activity.ComponentActivity
import androidx.lifecycle.lifecycleScope
import com.mathesis.attendance.R
import com.mathesis.attendance.databinding.ActivityMainBinding
import com.mathesis.attendance.util.PreferencesManager
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var preferencesManager: PreferencesManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        preferencesManager = PreferencesManager(this)

        setupDayButtons()
        setupSettingsButton()
        checkConfiguration()
    }

    private fun setupDayButtons() {
        val dayButtons = listOf(
            binding.btnMon to "월",
            binding.btnTue to "화",
            binding.btnWed to "수",
            binding.btnThu to "목",
            binding.btnFri to "금",
            binding.btnSat to "토",
            binding.btnSun to "일"
        )

        dayButtons.forEach { (button, day) ->
            button.setOnClickListener {
                val intent = Intent(this, StudentListActivity::class.java).apply {
                    putExtra("selected_day", day)
                }
                startActivity(intent)
            }
        }
    }

    private fun setupSettingsButton() {
        binding.settingsButton.setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }
    }

    private fun checkConfiguration() {
        lifecycleScope.launch {
            val isConfigured = preferencesManager.isConfigured()
            binding.statusText.text = if (isConfigured) {
                "연결됨"
            } else {
                "설정 필요"
            }
        }
    }

    override fun onResume() {
        super.onResume()
        checkConfiguration()
    }
}
