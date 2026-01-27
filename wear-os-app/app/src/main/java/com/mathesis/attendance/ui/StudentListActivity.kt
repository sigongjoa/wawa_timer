package com.mathesis.attendance.ui

import android.content.Intent
import android.os.Bundle
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
import kotlinx.coroutines.launch

class StudentListActivity : ComponentActivity() {

    private lateinit var binding: ActivityStudentListBinding
    private lateinit var preferencesManager: PreferencesManager
    private val students = mutableListOf<Student>()
    private var selectedDay: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityStudentListBinding.inflate(layoutInflater)
        setContentView(binding.root)

        preferencesManager = PreferencesManager(this)
        selectedDay = intent.getStringExtra("selected_day") ?: "월"

        setupRecyclerView()
        loadStudents()
    }

    private fun setupRecyclerView() {
        binding.studentRecyclerView.layoutManager = LinearLayoutManager(this)
        binding.studentRecyclerView.adapter = StudentAdapter(students) { student ->
            val intent = Intent(this, TimerActivity::class.java).apply {
                putExtra("student_id", student.id)
                putExtra("student_name", student.name)
                putExtra("student_grade", student.grade)
                putExtra("start_time", student.startTime)
                putExtra("end_time", student.endTime)
            }
            startActivity(intent)
        }
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

            val client = NotionClient(apiKey, dbId)
            val result = client.getStudentsByDay(selectedDay)

            binding.loadingProgress.visibility = View.GONE

            result.fold(
                onSuccess = { list ->
                    students.clear()
                    students.addAll(list)
                    binding.studentRecyclerView.adapter?.notifyDataSetChanged()

                    if (students.isEmpty()) {
                        binding.emptyText.visibility = View.VISIBLE
                    } else {
                        binding.studentRecyclerView.visibility = View.VISIBLE
                    }
                },
                onFailure = { error ->
                    binding.emptyText.text = "오류: ${error.message}"
                    binding.emptyText.visibility = View.VISIBLE
                    Toast.makeText(
                        this@StudentListActivity,
                        "로딩 실패: ${error.message}",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            )
        }
    }

    override fun onResume() {
        super.onResume()
        loadStudents()
    }

    private class StudentAdapter(
        private val students: List<Student>,
        private val onClick: (Student) -> Unit
    ) : RecyclerView.Adapter<StudentAdapter.ViewHolder>() {

        class ViewHolder(val binding: ItemStudentBinding) : RecyclerView.ViewHolder(binding.root)

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val binding = ItemStudentBinding.inflate(
                LayoutInflater.from(parent.context), parent, false
            )
            return ViewHolder(binding)
        }

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val student = students[position]

            holder.binding.nameText.text = "${student.name} (${student.grade})"
            holder.binding.timeText.text = "${student.startTime} - ${student.endTime}"

            val statusText = when {
                student.isCompleted -> "완료"
                student.isCheckedIn -> "수업중"
                else -> "대기"
            }

            val statusColor = when {
                student.isCompleted -> holder.itemView.context.getColor(R.color.text_secondary)
                student.isCheckedIn -> holder.itemView.context.getColor(R.color.check_in)
                else -> holder.itemView.context.getColor(R.color.accent)
            }

            holder.binding.statusText.text = statusText
            holder.binding.statusText.setTextColor(statusColor)

            holder.itemView.setOnClickListener { onClick(student) }
        }

        override fun getItemCount() = students.size
    }
}
