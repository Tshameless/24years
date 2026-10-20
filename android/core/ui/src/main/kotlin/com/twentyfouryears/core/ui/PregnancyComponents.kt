package com.twentyfouryears.core.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable
fun PregnancyPage(title: String, subtitle: String, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement=Arrangement.spacedBy(16.dp)) {
        Text(title,style=MaterialTheme.typography.headlineMedium,fontWeight=FontWeight.Bold)
        if(subtitle.isNotEmpty()) Text(subtitle,style=MaterialTheme.typography.bodyMedium,color=MaterialTheme.colorScheme.onSurfaceVariant)
        content()
        Spacer(Modifier.height(16.dp))
    }
}
@Composable
fun RecordCard(title: String, detail: String, content: @Composable ColumnScope.() -> Unit = {}) {
    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
            Text(title,style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.SemiBold)
            if(detail.isNotEmpty()) Text(detail,style=MaterialTheme.typography.bodyMedium)
            content()
        }
    }
}
@Composable fun EmptyRecords(text: String) { RecordCard("还没有记录",text) }
@Composable fun MedicalNotice() {
    Text("用于个人记录，不作诊断或用药建议。检查安排及补剂用法请遵循医嘱；不适或紧急情况请直接联系医疗机构。",style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant)
}
@Composable fun DeleteRecordButton(onDelete: () -> Unit) {
    var confirm by remember { mutableStateOf(false) }
    TextButton(onClick={confirm=true}) { Text("删除",color=MaterialTheme.colorScheme.error) }
    if(confirm) AlertDialog(onDismissRequest={confirm=false},title={Text("删除这条记录？")},text={Text("删除后无法撤销。关联账单会保留，避免误删已确认的支出。")},confirmButton={TextButton(onClick={confirm=false;onDelete()}){Text("删除")}},dismissButton={TextButton(onClick={confirm=false}){Text("取消")}})
}
data class InputField(val key: String,val label: String,val initial: String="",val numeric: Boolean=false,val multiline: Boolean=false)
@Composable
fun RecordForm(title: String, fields: List<InputField>, busy: Boolean, error: String?, onDismiss: () -> Unit, onSubmit: (Map<String,String>) -> Unit) {
    val values=fields.associate { field -> field.key to rememberSaveable(field.key) { mutableStateOf(field.initial) } }
    AlertDialog(onDismissRequest={if(!busy) onDismiss()},title={Text(title)},text={
        Column(Modifier.verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(10.dp)) {
            fields.forEach { field ->
                OutlinedTextField(value=values.getValue(field.key).value,onValueChange={values.getValue(field.key).value=it},label={Text(field.label)},modifier=Modifier.fillMaxWidth(),singleLine=!field.multiline,keyboardOptions=KeyboardOptions(keyboardType=if(field.numeric) KeyboardType.Decimal else KeyboardType.Text),enabled=!busy)
            }
            error?.let { Text(it,color=MaterialTheme.colorScheme.error) }
        }
    },confirmButton={TextButton(enabled=!busy,onClick={onSubmit(values.mapValues { it.value.value.trim() })}){Text(if(busy) "保存中…" else "保存")}},dismissButton={TextButton(enabled=!busy,onClick=onDismiss){Text("取消")}})
}
fun displayTimestamp(millis: Long): String = Instant.ofEpochMilli(millis).atZone(ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("MM-dd HH:mm"))
fun durationLabel(millis: Long): String { val seconds=millis.coerceAtLeast(0)/1000; return "${seconds/60}分${seconds%60}秒" }
