package com.twentyfouryears.core.domain

import com.twentyfouryears.core.model.*
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.LocalDate
import java.time.LocalTime
import java.time.temporal.ChronoUnit

data class Gestation(val weeks: Int, val days: Int, val daysUntilDue: Long)

fun gestation(dueDate: LocalDate, today: LocalDate = LocalDate.now()): Gestation {
    val remaining = ChronoUnit.DAYS.between(today, dueDate)
    val elapsed = (280 - remaining).coerceAtLeast(0).toInt()
    return Gestation(elapsed / 7, elapsed % 7, remaining)
}

fun parseAmount(text: String): Long {
    require(Regex("[0-9]{1,9}([.][0-9]{1,2})?").matches(text.trim())) { "金额需为正数，最多两位小数" }
    return BigDecimal(text.trim()).movePointRight(2).longValueExact().also { require(it > 0) { "金额必须大于零" } }
}
fun money(cents: Long): String = BigDecimal.valueOf(cents, 2).setScale(2, RoundingMode.UNNECESSARY).toPlainString()
fun netCashOutflow(entries: List<LedgerEntry>): Long = entries.sumOf { if (it.kind == EntryKind.EXPENSE) it.cents else -it.cents }
fun validDate(text: String): LocalDate = try { LocalDate.parse(text.trim()) } catch (_: Exception) { throw IllegalArgumentException("日期请使用 YYYY-MM-DD 格式") }
fun validTime(text: String): LocalTime = try { LocalTime.parse(text.trim()) } catch (_: Exception) { throw IllegalArgumentException("时间请使用 HH:mm 格式") }
fun validateProfile(profile: PregnancyProfile) {
    require(profile.id.isNotBlank() && profile.name.isNotBlank()) { "请填写称呼" }
    validDate(profile.dueDate)
}
fun validateVital(vital: Vital) {
    require(vital.value.isFinite() && (if(vital.kind==VitalKind.MOVEMENT) vital.value>=0 else vital.value>0)) { "请输入有效的非负数值；体重、血压和血糖需大于零" }
    if (vital.kind == VitalKind.BLOOD_PRESSURE) {
        val secondary=vital.secondary
        require(secondary != null && secondary.isFinite() && secondary > 0 && secondary < vital.value) { "请填写有效的收缩压和舒张压，收缩压应更高" }
    }
    if (vital.kind == VitalKind.MOVEMENT) require(vital.value % 1.0 == 0.0) { "次数必须是整数" }
}
