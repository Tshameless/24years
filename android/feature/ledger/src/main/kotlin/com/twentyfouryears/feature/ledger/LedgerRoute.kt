package com.twentyfouryears.feature.ledger

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.twentyfouryears.core.domain.*
import com.twentyfouryears.core.model.*
import com.twentyfouryears.core.ui.*
import com.twentyfouryears.core.ui.theme.*

@Composable
fun LedgerRoute(
    items: List<LedgerEntry>,
    onAdd: (EntryKind) -> Unit,
    onEdit: (LedgerEntry) -> Unit,
    onDelete: (LedgerEntry) -> Unit
) {
    var selectedFilter by remember { mutableStateOf<EntryKind?>(null) }

    val totalExpenseCents = items.filter { it.kind == EntryKind.EXPENSE }.sumOf { it.cents }
    val totalReimbursementCents = items.filter { it.kind == EntryKind.REIMBURSEMENT }.sumOf { it.cents }
    val totalAllowanceCents = items.filter { it.kind == EntryKind.ALLOWANCE }.sumOf { it.cents }
    val netOutflowCents = netCashOutflow(items)

    PregnancyPage(
        title = "家庭账本与津贴",
        subtitle = "医保冲抵对账 · 生娃真实净成本"
    ) {
        // 1. 真实生娃净支出核心看板 (Level 1 Ambient Precision)
        ClinicalCard(
            backgroundColor = SurfaceContainerLowest,
            borderColor = SurfaceContainer
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("生娃真实净成本", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                ClinicalBadge("医保与津贴对账", backgroundColor = SecondaryFixed, textColor = OnSecondaryFixedVariant)
            }

            // 大数字净支出
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(SurfaceContainerLow)
                    .padding(14.dp)
            ) {
                Text("当前现金净流出 (实付 − 报销 − 津贴)", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(
                    text = "¥ ${money(netOutflowCents)}",
                    style = MaterialTheme.typography.headlineLarge,
                    fontWeight = FontWeight.Bold,
                    color = Primary,
                    fontFamily = FontFamily.Monospace
                )
                Text(
                    "已剔除医保直接结算部分；负数表示报销及津贴到账超过当前实付现金。",
                    style = MaterialTheme.typography.bodySmall,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // 三项收支拆解
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(8.dp))
                        .background(SurfaceContainerLow)
                        .padding(8.dp)
                ) {
                    Text("现金支出", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(
                        "¥${money(totalExpenseCents)}",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                }
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(8.dp))
                        .background(SurfaceContainerLow)
                        .padding(8.dp)
                ) {
                    Text("医保报销", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(
                        "¥${money(totalReimbursementCents)}",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = Success,
                        fontFamily = FontFamily.Monospace
                    )
                }
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(8.dp))
                        .background(SurfaceContainerLow)
                        .padding(8.dp)
                ) {
                    Text("生育津贴", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(
                        "¥${money(totalAllowanceCents)}",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = Success,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }
        }

        // 2. 快捷记账操作栏
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Button(
                onClick = { onAdd(EntryKind.EXPENSE) },
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Primary)
            ) {
                Text("＋ 记支出", fontSize = 12.sp)
            }
            OutlinedButton(
                onClick = { onAdd(EntryKind.REIMBURSEMENT) },
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(8.dp)
            ) {
                Text("＋ 记报销", fontSize = 12.sp)
            }
            OutlinedButton(
                onClick = { onAdd(EntryKind.ALLOWANCE) },
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(8.dp)
            ) {
                Text("＋ 记津贴", fontSize = 12.sp)
            }
        }

        // 3. 记账流水明细
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("账目流水明细", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                TextButton(onClick = { selectedFilter = null }) {
                    Text(
                        "全部",
                        fontWeight = if (selectedFilter == null) FontWeight.Bold else FontWeight.Normal,
                        fontSize = 12.sp
                    )
                }
                EntryKind.entries.forEach { kind ->
                    TextButton(onClick = { selectedFilter = kind }) {
                        Text(
                            kind.label.take(2),
                            fontWeight = if (selectedFilter == kind) FontWeight.Bold else FontWeight.Normal,
                            fontSize = 12.sp
                        )
                    }
                }
            }
        }

        val visibleItems = items.filter { selectedFilter == null || it.kind == selectedFilter }

        if (visibleItems.isEmpty()) {
            EmptyRecords("暂无记录。点击上方按钮记录现金支付，或在完成产检时直接关联费用。")
        }

        visibleItems.forEach { item ->
            ClinicalCard(
                backgroundColor = SurfaceContainerLowest,
                borderColor = SurfaceContainer
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(item.title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                            if (item.checkupId != null) {
                                ClinicalBadge("产检关联", backgroundColor = SurfaceContainerHigh, textColor = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                        Text(
                            "${item.date} · ${item.kind.label}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    Column(horizontalAlignment = Alignment.End) {
                        Text(
                            text = "${if (item.kind == EntryKind.EXPENSE) "-" else "+"} ¥${money(item.cents)}",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = if (item.kind == EntryKind.EXPENSE) MaterialTheme.colorScheme.onSurface else Success,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(onClick = { onEdit(item) }) { Text("编辑", fontSize = 12.sp) }
                    DeleteRecordButton { onDelete(item) }
                }
            }
        }

        MedicalNotice()
    }
}
