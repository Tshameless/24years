package com.twentyfouryears.feature.vitals

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import com.twentyfouryears.core.model.*
import com.twentyfouryears.core.ui.*

@Composable
fun VitalsRoute(items: List<Vital>,onAdd: (VitalKind)->Unit,onDelete: (Vital)->Unit) {
    var filter by remember { mutableStateOf<VitalKind?>(null) }
    PregnancyPage("体征记录","保留测量值和测量情境，不自动判断正常或异常。") {
        VitalKind.entries.chunked(2).forEach { pair -> Row(horizontalArrangement=Arrangement.SpaceEvenly) { pair.forEach { kind -> TextButton(onClick={onAdd(kind)}){Text("＋ ${kind.label}")} } } }
        var menu by remember { mutableStateOf(false) }
        Box {
            OutlinedButton(onClick={menu=true}){Text(filter?.label ?: "全部记录")}
            DropdownMenu(expanded=menu,onDismissRequest={menu=false}) {
                DropdownMenuItem(text={Text("全部记录")},onClick={filter=null;menu=false})
                VitalKind.entries.forEach { kind -> DropdownMenuItem(text={Text(kind.label)},onClick={filter=kind;menu=false}) }
            }
        }
        val visible=items.filter { filter==null || it.kind==filter }
        if(visible.isEmpty()) EmptyRecords("选择上方记录类型，输入本次测量值。")
        visible.forEach { item ->
            val value=if(item.kind==VitalKind.BLOOD_PRESSURE) "${item.value.toInt()}/${item.secondary?.toInt()}" else item.value.toString().removeSuffix(".0")
            RecordCard("${item.kind.label} · $value ${item.kind.unit}",displayTimestamp(item.recordedAt)+" · "+item.notes) {DeleteRecordButton {onDelete(item)}}
        }
        MedicalNotice()
    }
}
