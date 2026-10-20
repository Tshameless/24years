package com.twentyfouryears.feature.home

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.twentyfouryears.core.model.*
import com.twentyfouryears.core.domain.*
import com.twentyfouryears.core.ui.*
import java.time.LocalDate

@Composable
fun HomeRoute(snapshot: PregnancySnapshot,onNavigate: (String)->Unit) {
    val p=snapshot.profile ?: return
    val today=LocalDate.now()
    PregnancyPage(if(p.silent) "给自己一点时间" else "${p.name}，今天也照顾好自己",if(p.silent) "已暂停孕期提醒。历史记录保存在这里。" else "你的孕期记录与日常安排 · 仅保存在本机") {
        if(!p.silent) {
            val age=gestation(LocalDate.parse(p.dueDate),today)
            RecordCard("孕 ${age.weeks} 周 + ${age.days} 天","预产期 ${p.dueDate} · 按预产期估算，请以医生确认日期为准") {
                Text(if(age.daysUntilDue>=0) "距预产期 ${age.daysUntilDue} 天" else "已过预产期 ${-age.daysUntilDue} 天",style=MaterialTheme.typography.headlineSmall)
            }
            val next=snapshot.checkups.firstOrNull { !it.completed && it.date>=today.toString() }
            RecordCard("下一次产检",next?.let { "${it.date} · ${it.title}" } ?: "按医生安排添加下一次预约") { TextButton(onClick={onNavigate("checkup")}) {Text("管理产检")} }
            val overdue=snapshot.checkups.count { !it.completed && it.date<today.toString() }
            if(overdue>0) Text("有 $overdue 条过去的预约尚未确认完成，请核对。")
            RecordCard("今日提醒",snapshot.reminders.filter { it.enabled }.let { list -> if(list.isEmpty()) "尚未设置提醒" else "已完成 ${list.count { it.completedDate==today.toString() }} / ${list.size}" }) { TextButton(onClick={onNavigate("reminders")}) {Text("查看与打卡")} }
        } else {
            RecordCard("按自己的节奏恢复","此模式不删除历史资料。你可以查看记录、导出备份，或在准备好时恢复提醒。") {TextButton(onClick={onNavigate("settings")}){Text("档案与关怀设置")}}
        }
        RecordCard("孕期现金净流出","¥${money(netCashOutflow(snapshot.ledger))} · 已付现金减后续报销与津贴到账") {TextButton(onClick={onNavigate("ledger")}) {Text("打开账本")}}
        OutlinedButton(onClick={onNavigate("contraction")},modifier=Modifier.fillMaxWidth()){Text("宫缩计时与历史")}
        OutlinedButton(onClick={onNavigate("emergency")},modifier=Modifier.fillMaxWidth()){Text("离线医疗信息卡")}
        MedicalNotice()
    }
}
