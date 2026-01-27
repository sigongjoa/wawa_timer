package com.mathesis.attendance.data

data class Student(
    val id: String,
    val name: String,
    val grade: String,
    val subject: String,
    val day: String,
    val startTime: String,  // "15:00" format
    val endTime: String,    // "16:30" format
    var checkInTime: Long? = null,
    var checkOutTime: Long? = null
) {
    val isCheckedIn: Boolean get() = checkInTime != null && checkOutTime == null
    val isCompleted: Boolean get() = checkInTime != null && checkOutTime != null

    fun getScheduledDuration(): Long {
        val startParts = startTime.split(":")
        val endParts = endTime.split(":")
        val startMinutes = startParts[0].toInt() * 60 + startParts[1].toInt()
        val endMinutes = endParts[0].toInt() * 60 + endParts[1].toInt()
        return (endMinutes - startMinutes) * 60 * 1000L
    }

    fun getElapsedTime(): Long {
        val checkIn = checkInTime ?: return 0
        val checkOut = checkOutTime ?: System.currentTimeMillis()
        return checkOut - checkIn
    }
}
