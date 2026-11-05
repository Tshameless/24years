package com.twentyfouryears.core.ui

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.twentyfouryears.core.ui.theme.*
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable
fun PregnancyPage(
    title: String,
    subtitle: String,
    content: @Composable ColumnScope.() -> Unit
) {
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            if (subtitle.isNotEmpty()) {
                Text(
                    subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
        content()
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
fun ClinicalCard(
    modifier: Modifier = Modifier,
    backgroundColor: Color = MaterialTheme.colorScheme.surface,
    borderColor: Color = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f),
    content: @Composable ColumnScope.() -> Unit
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        color = backgroundColor,
        tonalElevation = 1.dp,
        shadowElevation = 1.dp,
        border = androidx.compose.foundation.BorderStroke(1.dp, borderColor)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            content()
        }
    }
}

@Composable
fun RecordCard(title: String, detail: String, content: @Composable ColumnScope.() -> Unit = {}) {
    ClinicalCard {
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        if (detail.isNotEmpty()) {
            Text(detail, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        content()
    }
}

@Composable
fun ClinicalBadge(
    text: String,
    modifier: Modifier = Modifier,
    backgroundColor: Color = MaterialTheme.colorScheme.primaryContainer,
    textColor: Color = MaterialTheme.colorScheme.onPrimaryContainer,
    hasPulseDot: Boolean = false,
    dotColor: Color = Success
) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(9999.dp))
            .background(backgroundColor)
            .padding(horizontal = 8.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        if (hasPulseDot) {
            Box(
                Modifier
                    .size(6.dp)
                    .clip(CircleShape)
                    .background(dotColor)
            )
        }
        Text(
            text = text,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            color = textColor,
            fontFamily = FontFamily.Monospace
        )
    }
}

@Composable
fun DualActorBadge(
    role: String,
    isMom: Boolean = true
) {
    val bg = if (isMom) PrimaryFixed else SecondaryFixed
    val fg = if (isMom) OnPrimaryFixedVariant else OnSecondaryFixedVariant
    Text(
        text = role,
        fontSize = 11.sp,
        fontWeight = FontWeight.SemiBold,
        color = fg,
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(bg)
            .padding(horizontal = 6.dp, vertical = 2.dp)
    )
}

@Composable
fun ClinicalSectionHeader(
    title: String,
    badgeText: String? = null,
    trailingText: String? = null,
    onTrailingClick: (() -> Unit)? = null
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
            if (badgeText != null) {
                ClinicalBadge(text = badgeText)
            }
        }
        if (trailingText != null) {
            Text(
                text = trailingText,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.clickable(enabled = onTrailingClick != null) { onTrailingClick?.invoke() }
            )
        }
    }
}

@Composable
fun EbmGuideBox(
    title: String,
    tag: String = "EBM 循证指南",
    items: List<Pair<String, String>>,
    warning: String? = null
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(SurfaceContainerLow)
            .border(1.dp, SurfaceContainer, RoundedCornerShape(12.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(title, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
            ClinicalBadge(tag, backgroundColor = PrimaryFixed, textColor = OnPrimaryFixedVariant)
        }
        HorizontalDivider(color = SurfaceContainer, thickness = 1.dp)
        items.forEach { (label, desc) ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.Top
            ) {
                Text(
                    text = label,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier
                        .clip(RoundedCornerShape(4.dp))
                        .background(SurfaceContainerHigh)
                        .padding(horizontal = 4.dp, vertical = 1.dp)
                )
                Text(
                    text = desc,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f)
                )
            }
        }
        if (warning != null) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(Modifier.size(6.dp).clip(CircleShape).background(Danger))
                Text(
                    text = warning,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                    color = Danger
                )
            }
        }
    }
}

@Composable
fun PercentileGauge(
    label: String,
    subtitle: String,
    value: Double,
    unit: String,
    p10: Double,
    p50: Double,
    p90: Double,
    percentileTag: String
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(SurfaceContainerLow)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(label, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
                Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(
                        text = "%.1f".format(value),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                    Text(
                        text = " $unit",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                ClinicalBadge(percentileTag, backgroundColor = SecondaryFixed, textColor = OnSecondaryFixedVariant)
            }
        }
        // Horizontal percentile track
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(SurfaceContainerHighest)
        ) {
            // P10 to P90 safe normal corridor in mint
            Box(
                modifier = Modifier
                    .fillMaxHeight()
                    .fillMaxWidth(0.8f)
                    .align(Alignment.Center)
                    .clip(RoundedCornerShape(4.dp))
                    .background(SecondaryFixed.copy(alpha = 0.8f))
            )
            // Current value indicator dot (approximated position)
            val posRatio = ((value - p10) / (p90 - p10).coerceAtLeast(0.1)).coerceIn(0.0, 1.0)
            Box(
                modifier = Modifier
                    .fillMaxHeight()
                    .width(8.dp)
                    .align(Alignment.CenterStart)
                    .padding(start = ((posRatio * 260).dp).coerceAtMost(280.dp))
                    .clip(CircleShape)
                    .background(Primary)
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text("P10 (%.1f%s)".format(p10, unit), fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, fontFamily = FontFamily.Monospace)
            Text("中位数 P50 (%.1f%s)".format(p50, unit), fontSize = 10.sp, color = Primary, fontWeight = FontWeight.Medium, fontFamily = FontFamily.Monospace)
            Text("P90 (%.1f%s)".format(p90, unit), fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, fontFamily = FontFamily.Monospace)
        }
    }
}

@Composable
fun EmptyRecords(text: String) { RecordCard("还没有记录", text) }

@Composable
fun MedicalNotice() {
    Text(
        "用于个人记录与临床循证辅导，不作诊断或处方建议。检查安排及补剂用法请遵循医嘱；不适或紧急情况请直接联系医疗机构。",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant
    )
}

@Composable
fun DeleteRecordButton(onDelete: () -> Unit) {
    var confirm by remember { mutableStateOf(false) }
    TextButton(onClick = { confirm = true }) { Text("删除", color = MaterialTheme.colorScheme.error) }
    if (confirm) AlertDialog(
        onDismissRequest = { confirm = false },
        title = { Text("删除这条记录？") },
        text = { Text("删除后无法撤销。关联账单会保留，避免误删已确认的支出。") },
        confirmButton = { TextButton(onClick = { confirm = false; onDelete() }) { Text("删除") } },
        dismissButton = { TextButton(onClick = { confirm = false }) { Text("取消") } }
    )
}

data class InputField(
    val key: String,
    val label: String,
    val initial: String = "",
    val numeric: Boolean = false,
    val multiline: Boolean = false
)

@Composable
fun RecordForm(
    title: String,
    fields: List<InputField>,
    busy: Boolean,
    error: String?,
    onDismiss: () -> Unit,
    onSubmit: (Map<String, String>) -> Unit
) {
    val values = fields.associate { field -> field.key to rememberSaveable(field.key) { mutableStateOf(field.initial) } }
    AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        title = { Text(title) },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                fields.forEach { field ->
                    OutlinedTextField(
                        value = values.getValue(field.key).value,
                        onValueChange = { values.getValue(field.key).value = it },
                        label = { Text(field.label) },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = !field.multiline,
                        keyboardOptions = KeyboardOptions(keyboardType = if (field.numeric) KeyboardType.Decimal else KeyboardType.Text),
                        enabled = !busy
                    )
                }
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            }
        },
        confirmButton = {
            TextButton(
                enabled = !busy,
                onClick = { onSubmit(values.mapValues { it.value.value.trim() }) }
            ) { Text(if (busy) "保存中…" else "保存") }
        },
        dismissButton = {
            TextButton(enabled = !busy, onClick = onDismiss) { Text("取消") }
        }
    )
}

fun displayTimestamp(millis: Long): String =
    Instant.ofEpochMilli(millis).atZone(ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("MM-dd HH:mm"))

fun durationLabel(millis: Long): String {
    val seconds = millis.coerceAtLeast(0) / 1000
    return "${seconds / 60}分${seconds % 60}秒"
}
