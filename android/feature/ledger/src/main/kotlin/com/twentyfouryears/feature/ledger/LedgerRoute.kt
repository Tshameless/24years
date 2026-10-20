package com.twentyfouryears.feature.ledger

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import com.twentyfouryears.core.domain.*
import com.twentyfouryears.core.model.*
import com.twentyfouryears.core.ui.*

@Composable
fun LedgerRoute(items: List<LedgerEntry>,onAdd: (EntryKind)->Unit,onEdit: (LedgerEntry)->Unit,onDelete: (LedgerEntry)->Unit) {
    PregnancyPage("孕期账本","仅统计实际现金流。已由医保直接结算的金额不再作为报销收入重复扣减。") {
        RecordCard("现金净流出","¥${money(netCashOutflow(items))}") {
            Text("现金支出 ¥${money(items.filter { it.kind==EntryKind.EXPENSE }.sumOf {it.cents})}")
            Text("报销与津贴到账 ¥${money(items.filter { it.kind!=EntryKind.EXPENSE }.sumOf {it.cents})}")
            Text("负数表示本期到账超过支出；不代表完整养育成本。",style=MaterialTheme.typography.bodySmall)
        }
        EntryKind.entries.forEach { kind -> OutlinedButton(onClick={onAdd(kind)}){Text("＋ ${kind.label}")} }
        if(items.isEmpty()) EmptyRecords("记录一笔实际支付，或在完成产检时关联费用。")
        items.forEach { item -> RecordCard(item.title,"${item.date} · ${item.kind.label} · ¥${money(item.cents)}${if(item.checkupId!=null) " · 关联产检" else ""}") {
            TextButton(onClick={onEdit(item)}){Text("编辑")}
            DeleteRecordButton {onDelete(item)}
        }}
    }
}
