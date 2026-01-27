package com.mathesis.attendance.data

data class AttendanceRecord(
    val studentId: String,
    val studentName: String,
    val date: String,           // "2024-01-27" format
    val checkInTime: Long,      // Unix timestamp
    val checkOutTime: Long?,    // Unix timestamp, null if not checked out
    val scheduledStart: String,
    val scheduledEnd: String,
    val actualDuration: Long?   // in milliseconds
)
