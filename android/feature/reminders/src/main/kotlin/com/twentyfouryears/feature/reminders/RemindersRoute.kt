package com.twentyfouryears.feature.reminders

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import com.twentyfouryears.core.model.Reminder
import com.twentyfouryears.core.ui.*
import java.time.LocalDate

@Composable
fun RemindersRoute(items: List<Reminder>,silent: Boolean,onAdd: ()->Unit,onEdit: (Reminder)->Unit,onToggle: (Reminder)->Unit,onComplete: (Reminder)->Unit,onDelete: (Reminder)->Unit,onPermission: ()->Unit) {
    PregnancyPage("每日提醒","自行填写遵医嘱的补剂或日常事项。系统约每 15 分钟检查一次，省电限制可能导致延迟或漏发；重要事项请另设系统闹钟。") {
        if(silent) RecordCard("静默关怀已开启","所有孕期通知已暂停，恢复后重新安排。")
        Button(onClick=onAdd){Text("＋ 添加每日提醒")}
        TextButton(onClick=onPermission){Text("开启 / 检查通知权限")}
        if(items.isEmpty()) EmptyRecords("例如：按处方服用补剂。请自行填写医生建议的时间与用法。")
        items.forEach { item -> RecordCard(item.title,"每天 ${item.time} · ${if(item.enabled) "已启用" else "已暂停"}") {
            TextButton(onClick={onComplete(item)}){Text(if(item.completedDate==LocalDate.now().toString()) "今日已完成 · 撤销" else "今日打卡")}
            TextButton(onClick={onEdit(item)}){Text("编辑")}
            TextButton(onClick={onToggle(item)}){Text(if(item.enabled) "暂停提醒" else "启用提醒")}
            DeleteRecordButton {onDelete(item)}
        }}
        MedicalNotice()
    }
}
