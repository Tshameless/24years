package com.twentyfouryears.feature.checkup

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import com.twentyfouryears.core.model.Checkup
import com.twentyfouryears.core.ui.*

@Composable
fun CheckupRoute(items: List<Checkup>,onAdd: ()->Unit,onEdit: (Checkup)->Unit,onComplete: (Checkup)->Unit,onDelete: (Checkup)->Unit) {
    PregnancyPage("产检安排","按实际医嘱添加预约。预约前一天 09:00 起尝试通知，请开启通知权限；省电限制可能使提醒延迟或漏发。") {
        Button(onClick=onAdd){Text("＋ 添加产检")}
        if(items.isEmpty()) EmptyRecords("添加第一次预约，日期和项目均可自行调整。")
        items.forEach { item ->
            RecordCard("${if(item.completed) "已完成" else "待完成"} · ${item.title}","${item.date} · ${item.notes}") {
                TextButton(onClick={onEdit(item)}){Text("编辑记录")}
                TextButton(onClick={onComplete(item)}){Text(if(item.completed) "标为未完成" else "完成 / 关联一笔费用")}
                DeleteRecordButton { onDelete(item) }
            }
        }
        MedicalNotice()
    }
}
