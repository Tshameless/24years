package com.twentyfouryears.feature.contraction

import androidx.compose.material3.*
import androidx.compose.runtime.*
import android.os.SystemClock
import com.twentyfouryears.core.model.Contraction
import com.twentyfouryears.core.ui.*
import kotlinx.coroutines.delay

@Composable
fun ContractionRoute(items: List<Contraction>,busy: Boolean,onStart: ()->Unit,onStop: ()->Unit,onEmergency: ()->Unit,onDelete: (Contraction)->Unit) {
    val active=items.firstOrNull {it.endedAt==null}
    var now by remember {mutableLongStateOf(SystemClock.elapsedRealtime())}
    LaunchedEffect(active?.id) {while(active!=null){now=SystemClock.elapsedRealtime();delay(250)}}
    PregnancyPage("宫缩计时","每次宫缩开始时点击开始，结束时点击结束。记录供就医沟通，不自动判定临产或输出 5-1-1 警报。") {
        RecordCard(if(active!=null) "本次持续" else "准备记录",if(active!=null) durationLabel(now-active.elapsedStart) else "计时记录将保存在本机") {
            Button(enabled=!busy,onClick=if(active==null) onStart else onStop){Text(if(active==null) "开始本次宫缩" else "结束本次宫缩")}
        }
        OutlinedButton(onClick=onEmergency){Text("打开医疗信息与拨号")}
        if(items.isEmpty()) EmptyRecords("暂无计时记录。")
        items.forEachIndexed { index,item ->
            val previous=items.getOrNull(index+1)
            val interval=previous?.takeIf {it.bootCount==item.bootCount && it.bootCount>=0}?.let {(item.elapsedStart-it.elapsedStart).takeIf { diff -> diff>=0 }}
            RecordCard(displayTimestamp(item.startedAt),when {
                item.interrupted -> "计时中断（重启、恢复备份或静默关怀），持续时间未知"
                item.endedAt==null -> "正在记录"
                else -> "持续 ${durationLabel(item.durationMillis ?: 0)}"
            } + (interval?.let { " · 距上次开始 ${durationLabel(it)}" } ?: "")) {if(item.endedAt!=null) DeleteRecordButton {onDelete(item)}}
        }
        MedicalNotice()
    }
}
