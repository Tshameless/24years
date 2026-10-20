package com.twentyfouryears.feature.silentcare

import androidx.compose.material3.*
import androidx.compose.runtime.*
import com.twentyfouryears.core.model.PregnancyProfile
import com.twentyfouryears.core.ui.*

@Composable
fun SilentCareRoute(profile: PregnancyProfile,onEdit: ()->Unit,onSilent: ()->Unit,onExport: ()->Unit,onImport: ()->Unit,onErase: ()->Unit) {
    var confirm by remember {mutableStateOf<String?>(null)}
    PregnancyPage("档案与设置","管理这一段孕期的资料、提醒与本地备份。") {
        RecordCard(profile.name,"预产期 ${profile.dueDate}") {TextButton(onClick=onEdit){Text("编辑档案与医疗信息")}}
        RecordCard("静默关怀",if(profile.silent) "已开启：隐藏首页孕周，暂停通知，保留全部记录。" else "随时暂停孕周展示和孕期提醒，无需说明原因。") {OutlinedButton(onClick={confirm="silent"}){Text(if(profile.silent) "恢复孕期展示与提醒" else "开启静默关怀")}}
        RecordCard("数据备份","JSON 备份包含个人健康信息，未加密。请保存到可信位置；当前没有云同步。恢复备份会替换当前全部孕期记录。") {
            TextButton(onClick=onExport){Text("导出完整备份")}
            TextButton(onClick=onImport){Text("恢复备份")}
        }
        TextButton(onClick={confirm="erase"}){Text("清除本机孕期数据",color=MaterialTheme.colorScheme.error)}
        Text("24Years · 孕期本地版 0.1.0 · 本版不含账号、家庭同步、医学诊断和自动更新。",style=MaterialTheme.typography.bodySmall)
    }
    confirm?.let { action -> AlertDialog(onDismissRequest={confirm=null},title={Text(if(action=="erase") "清除所有孕期记录？" else if(profile.silent) "恢复孕期提醒？" else "开启静默关怀？")},text={Text(if(action=="erase") "这将删除本机的档案、体征、产检、账单、提醒及宫缩记录，无法撤销。请先导出备份。" else if(profile.silent) "首页将重新展示孕周，已启用的提醒将重新安排。" else "将立即取消孕期通知并隐藏首页孕周，历史资料不会删除。")},confirmButton={TextButton(onClick={confirm=null;if(action=="erase") onErase() else onSilent()}){Text("确认")}},dismissButton={TextButton(onClick={confirm=null}){Text("取消")}}) }
}
