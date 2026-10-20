package com.twentyfouryears.core.model

data class PregnancyProfile(
    val id: String,
    val name: String,
    val dueDate: String,
    val silent: Boolean = false,
    val hospital: String = "",
    val contact: String = "",
    val medicalNotes: String = "",
)

data class Checkup(val id: String, val pregnancyId: String, val title: String, val date: String, val notes: String = "", val completed: Boolean = false)
enum class VitalKind(val label: String, val unit: String) {
    WEIGHT("体重", "kg"), BLOOD_PRESSURE("血压", "mmHg"), GLUCOSE("血糖", "mmol/L"), MOVEMENT("胎动记录", "次")
}
data class Vital(val id: String, val pregnancyId: String, val kind: VitalKind, val value: Double, val secondary: Double? = null, val recordedAt: Long, val notes: String = "")
enum class EntryKind(val label: String) { EXPENSE("现金支出"), REIMBURSEMENT("后续报销到账"), ALLOWANCE("津贴到账") }
data class LedgerEntry(val id: String, val pregnancyId: String, val title: String, val kind: EntryKind, val cents: Long, val date: String, val checkupId: String? = null)
data class Reminder(val id: String, val pregnancyId: String, val title: String, val time: String, val enabled: Boolean = true, val completedDate: String? = null)
data class Contraction(val id: String, val pregnancyId: String, val startedAt: Long, val endedAt: Long? = null, val elapsedStart: Long, val durationMillis: Long? = null, val interrupted: Boolean = false, val bootCount: Int = -1)
data class PregnancySnapshot(
    val profile: PregnancyProfile? = null,
    val checkups: List<Checkup> = emptyList(),
    val vitals: List<Vital> = emptyList(),
    val ledger: List<LedgerEntry> = emptyList(),
    val reminders: List<Reminder> = emptyList(),
    val contractions: List<Contraction> = emptyList(),
)
