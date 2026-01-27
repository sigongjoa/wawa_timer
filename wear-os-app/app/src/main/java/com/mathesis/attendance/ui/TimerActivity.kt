package com.mathesis.attendance.ui

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.view.View
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.lifecycle.lifecycleScope
import com.mathesis.attendance.api.NotionClient
import com.mathesis.attendance.databinding.ActivityTimerBinding
import com.mathesis.attendance.util.PreferencesManager
import com.mathesis.attendance.util.TimeUtils
import kotlinx.coroutines.launch

class TimerActivity : ComponentActivity() {

    private lateinit var binding: ActivityTimerBinding
    private lateinit var preferencesManager: PreferencesManager

    private var studentId: String = ""
    private var studentName: String = ""
    private var startTime: String = ""
    private var endTime: String = ""

    private var checkInTimestamp: Long? = null
    private var isRunning = false

    private val handler = Handler(Looper.getMainLooper())
    private val timerRunnable = object : Runnable {
        override fun run() {
            updateTimer()
            if (isRunning) {
                handler.postDelayed(this, 1000)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityTimerBinding.inflate(layoutInflater)
        setContentView(binding.root)

        preferencesManager = PreferencesManager(this)

        // Get data from intent
        studentId = intent.getStringExtra("student_id") ?: ""
        studentName = intent.getStringExtra("student_name") ?: ""
        startTime = intent.getStringExtra("start_time") ?: ""
        endTime = intent.getStringExtra("end_time") ?: ""

        setupUI()
        setupButtons()
    }

    private fun setupUI() {
        binding.studentNameText.text = studentName
        binding.scheduleText.text = "$startTime - $endTime"
        binding.timerText.text = "00:00"
    }

    private fun setupButtons() {
        binding.checkInButton.setOnClickListener {
            performCheckIn()
        }

        binding.checkOutButton.setOnClickListener {
            performCheckOut()
        }
    }

    private fun performCheckIn() {
        lifecycleScope.launch {
            binding.checkInButton.isEnabled = false

            val apiKey = preferencesManager.getApiKey()
            val dbId = preferencesManager.getDatabaseId()
            val client = NotionClient(apiKey, dbId)

            val result = client.recordCheckIn(studentId)

            result.fold(
                onSuccess = {
                    checkInTimestamp = System.currentTimeMillis()
                    isRunning = true

                    // Update UI
                    binding.checkInButton.visibility = View.GONE
                    binding.checkOutButton.visibility = View.VISIBLE
                    binding.timerLabelText.text = "경과 시간"

                    // Start timer
                    handler.post(timerRunnable)

                    // Vibrate
                    vibrate()

                    Toast.makeText(this@TimerActivity, "입실 완료", Toast.LENGTH_SHORT).show()
                },
                onFailure = { error ->
                    binding.checkInButton.isEnabled = true
                    Toast.makeText(
                        this@TimerActivity,
                        "입실 실패: ${error.message}",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            )
        }
    }

    private fun performCheckOut() {
        lifecycleScope.launch {
            binding.checkOutButton.isEnabled = false

            val apiKey = preferencesManager.getApiKey()
            val dbId = preferencesManager.getDatabaseId()
            val client = NotionClient(apiKey, dbId)

            val result = client.recordCheckOut(studentId)

            result.fold(
                onSuccess = {
                    isRunning = false
                    handler.removeCallbacks(timerRunnable)

                    // Calculate total time
                    val checkIn = checkInTimestamp ?: System.currentTimeMillis()
                    val elapsed = System.currentTimeMillis() - checkIn
                    val formattedTime = TimeUtils.formatDuration(elapsed)

                    // Update UI
                    binding.checkOutButton.visibility = View.GONE
                    binding.timerLabelText.text = "총 수업 시간: $formattedTime"

                    // Vibrate
                    vibrate()

                    Toast.makeText(this@TimerActivity, "퇴실 완료", Toast.LENGTH_SHORT).show()
                },
                onFailure = { error ->
                    binding.checkOutButton.isEnabled = true
                    Toast.makeText(
                        this@TimerActivity,
                        "퇴실 실패: ${error.message}",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            )
        }
    }

    private fun updateTimer() {
        val checkIn = checkInTimestamp ?: return
        val elapsed = System.currentTimeMillis() - checkIn
        binding.timerText.text = TimeUtils.formatDuration(elapsed)

        // Check if over scheduled time
        val scheduledDuration = getScheduledDuration()
        if (elapsed > scheduledDuration) {
            binding.timerText.setTextColor(getColor(com.mathesis.attendance.R.color.timer_warning))
        }
    }

    private fun getScheduledDuration(): Long {
        val startMinutes = TimeUtils.parseTimeToMinutes(startTime)
        val endMinutes = TimeUtils.parseTimeToMinutes(endTime)
        return (endMinutes - startMinutes) * 60 * 1000L
    }

    private fun vibrate() {
        val vibrator = getSystemService(Vibrator::class.java)
        vibrator?.vibrate(VibrationEffect.createOneShot(200, VibrationEffect.DEFAULT_AMPLITUDE))
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacks(timerRunnable)
    }
}
