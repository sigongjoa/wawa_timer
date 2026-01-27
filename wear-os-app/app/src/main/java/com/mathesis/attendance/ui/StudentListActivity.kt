package com.mathesis.attendance.ui

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.mathesis.attendance.R
import com.mathesis.attendance.api.NotionClient
import com.mathesis.attendance.data.Student
import com.mathesis.attendance.databinding.ActivityStudentListBinding
import com.mathesis.attendance.databinding.ItemStudentBinding
import com.mathesis.attendance.util.PreferencesManager
import com.mathesis.attendance.util.TimeUtils
import kotlinx.coroutines.launch

class StudentListActivity : ComponentActivity() {

    private lateinit var binding: ActivityStudentListBinding
    private lateinit var preferencesManager: PreferencesManager
    private lateinit var notionClient: NotionClient
    private val students = mutableListOf<StudentState>()
    private var selectedDay: String = ""
    private lateinit var adapter: StudentAdapter

    private val handler = Handler(Looper.getMainLooper())
    private val timerRunnable = object : Runnable {
        override fun run() {
            updateAllTimers()
            handler.postDelayed(this, 1000)
        }
    }

    // 학생 상태를 관리하는 데이터 클래스
    data class StudentState(
        val student: Student,
        var status: Status = Status.WAITING,
        var checkInTime: Long? = null,
        var notifiedEndingSoon: Boolean = false
    ) {
        enum class Status { WAITING, IN_PROGRESS, COMPLETED }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityStudentListBinding.inflate(layoutInflater)
        setContentView(binding.root)

        preferencesManager = PreferencesManager(this)
        selectedDay = intent.getStringExtra("selected_day") ?: "월"

        setupRecyclerView()
        loadStudents()

        // 타이머 시작
        handler.post(timerRunnable)
    }

    private fun setupRecyclerView() {
        adapter = StudentAdapter(
            students = students,
            onCheckIn = { state -> performCheckIn(state) },
            onCheckOut = { state -> performCheckOut(state) }
        )
        binding.studentRecyclerView.layoutManager = LinearLayoutManager(this)
        binding.studentRecyclerView.adapter = adapter
    }

    private fun loadStudents() {
        lifecycleScope.launch {
            binding.loadingProgress.visibility = View.VISIBLE
            binding.emptyText.visibility = View.GONE
            binding.studentRecyclerView.visibility = View.GONE

            val apiKey = preferencesManager.getApiKey()
            val dbId = preferencesManager.getDatabaseId()

            if (apiKey.isBlank() || dbId.isBlank()) {
                binding.loadingProgress.visibility = View.GONE
                binding.emptyText.text = "설정에서 API 키를 입력하세요"
                binding.emptyText.visibility = View.VISIBLE
                return@launch
            }

            notionClient = NotionClient(apiKey, dbId)
            val result = notionClient.getStudentsByDay(selectedDay)

            binding.loadingProgress.visibility = View.GONE

            result.fold(
                onSuccess = { list ->
                    students.clear()
                    students.addAll(list.map { StudentState(it) })
                    adapter.notifyDataSetChanged()

                    if (students.isEmpty()) {
                        binding.emptyText.text = "${selectedDay}요일 학생 없음"
                        binding.emptyText.visibility = View.VISIBLE
                    } else {
                        binding.studentRecyclerView.visibility = View.VISIBLE
                    }
                },
                onFailure = { error ->
                    binding.emptyText.text = "오류: ${error.message}"
                    binding.emptyText.visibility = View.VISIBLE
                }
            )
        }
    }

    private fun performCheckIn(state: StudentState) {
        lifecycleScope.launch {
            val result = notionClient.recordCheckIn(state.student.id)
            result.fold(
                onSuccess = {
                    state.status = StudentState.Status.IN_PROGRESS
                    state.checkInTime = System.currentTimeMillis()
                    adapter.notifyDataSetChanged()
                    vibrate()
                    Toast.makeText(this@StudentListActivity, "${state.student.name} 입실", Toast.LENGTH_SHORT).show()
                },
                onFailure = { error ->
                    Toast.makeText(this@StudentListActivity, "입실 실패: ${error.message}", Toast.LENGTH_SHORT).show()
                }
            )
        }
    }

    private fun performCheckOut(state: StudentState) {
        lifecycleScope.launch {
            val result = notionClient.recordCheckOut(state.student.id)
            result.fold(
                onSuccess = {
                    state.status = StudentState.Status.COMPLETED
                    adapter.notifyDataSetChanged()
                    vibrate()
                    Toast.makeText(this@StudentListActivity, "${state.student.name} 퇴실", Toast.LENGTH_SHORT).show()
                },
                onFailure = { error ->
                    Toast.makeText(this@StudentListActivity, "퇴실 실패: ${error.message}", Toast.LENGTH_SHORT).show()
                }
            )
        }
    }

    private fun updateAllTimers() {
        var needsUpdate = false
        for (state in students) {
            if (state.status == StudentState.Status.IN_PROGRESS && state.checkInTime != null) {
                needsUpdate = true

                // 종료 시간 5분 전 알림
                val elapsed = System.currentTimeMillis() - state.checkInTime!!
                val scheduledDuration = getScheduledDuration(state.student)
                val remaining = scheduledDuration - elapsed

                if (remaining in 0..300000 && !state.notifiedEndingSoon) { // 5분 = 300000ms
                    state.notifiedEndingSoon = true
                    vibrateLong()
                    Toast.makeText(this, "${state.student.name} 수업 종료 임박!", Toast.LENGTH_LONG).show()
                }
            }
        }
        if (needsUpdate) {
            adapter.notifyDataSetChanged()
        }
    }

    private fun getScheduledDuration(student: Student): Long {
        val startMinutes = TimeUtils.parseTimeToMinutes(student.startTime)
        val endMinutes = TimeUtils.parseTimeToMinutes(student.endTime)
        return (endMinutes - startMinutes) * 60 * 1000L
    }

    private fun vibrate() {
        val vibrator = getSystemService(Vibrator::class.java)
        vibrator?.vibrate(VibrationEffect.createOneShot(200, VibrationEffect.DEFAULT_AMPLITUDE))
    }

    private fun vibrateLong() {
        val vibrator = getSystemService(Vibrator::class.java)
        vibrator?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 300, 200, 300), -1))
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacks(timerRunnable)
    }

    // Adapter
    private class StudentAdapter(
        private val students: List<StudentState>,
        private val onCheckIn: (StudentState) -> Unit,
        private val onCheckOut: (StudentState) -> Unit
    ) : RecyclerView.Adapter<StudentAdapter.ViewHolder>() {

        class ViewHolder(val binding: ItemStudentBinding) : RecyclerView.ViewHolder(binding.root)

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val binding = ItemStudentBinding.inflate(
                LayoutInflater.from(parent.context), parent, false
            )
            return ViewHolder(binding)
        }

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val state = students[position]
            val student = state.student
            val context = holder.itemView.context

            // 이름, 시간 표시
            holder.binding.nameText.text = "${student.name} (${student.grade})"
            holder.binding.timeText.text = "${student.startTime} - ${student.endTime}"

            // 상태에 따른 UI 설정
            when (state.status) {
                StudentState.Status.WAITING -> {
                    holder.binding.checkInButton.visibility = View.VISIBLE
                    holder.binding.checkOutButton.visibility = View.GONE
                    holder.binding.completedText.visibility = View.GONE
                    holder.binding.timerText.visibility = View.GONE
                }
                StudentState.Status.IN_PROGRESS -> {
                    holder.binding.checkInButton.visibility = View.GONE
                    holder.binding.checkOutButton.visibility = View.VISIBLE
                    holder.binding.completedText.visibility = View.GONE
                    holder.binding.timerText.visibility = View.VISIBLE

                    // 타이머 표시
                    val elapsed = System.currentTimeMillis() - (state.checkInTime ?: System.currentTimeMillis())
                    holder.binding.timerText.text = "⏱ ${TimeUtils.formatDuration(elapsed)}"

                    // 시간 초과 시 색상 변경
                    val startMinutes = TimeUtils.parseTimeToMinutes(student.startTime)
                    val endMinutes = TimeUtils.parseTimeToMinutes(student.endTime)
                    val scheduledDuration = (endMinutes - startMinutes) * 60 * 1000L
                    if (elapsed > scheduledDuration) {
                        holder.binding.timerText.setTextColor(context.getColor(R.color.timer_warning))
                    } else {
                        holder.binding.timerText.setTextColor(context.getColor(R.color.accent))
                    }
                }
                StudentState.Status.COMPLETED -> {
                    holder.binding.checkInButton.visibility = View.GONE
                    holder.binding.checkOutButton.visibility = View.GONE
                    holder.binding.completedText.visibility = View.VISIBLE
                    holder.binding.timerText.visibility = View.GONE
                }
            }

            // 버튼 클릭 리스너
            holder.binding.checkInButton.setOnClickListener { onCheckIn(state) }
            holder.binding.checkOutButton.setOnClickListener { onCheckOut(state) }
        }

        override fun getItemCount() = students.size
    }
}
