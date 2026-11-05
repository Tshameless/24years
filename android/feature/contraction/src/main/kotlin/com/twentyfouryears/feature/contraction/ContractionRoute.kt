package com.twentyfouryears.feature.contraction

import android.os.SystemClock
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.twentyfouryears.core.model.Contraction
import com.twentyfouryears.core.ui.*
import com.twentyfouryears.core.ui.theme.*
import kotlinx.coroutines.delay

@Composable
fun ContractionRoute(
    items: List<Contraction>,
    busy: Boolean,
    onStart: () -> Unit,
    onStop: () -> Unit,
    onEmergency: () -> Unit,
    onDelete: (Contraction) -> Unit
) {
    val active = items.firstOrNull { it.endedAt == null }
    var now by remember { mutableLongStateOf(SystemClock.elapsedRealtime()) }
    var showPostureModal by remember { mutableStateOf(false) }
    var showBagModal by remember { mutableStateOf(false) }
    var showPlanModal by remember { mutableStateOf(false) }

    LaunchedEffect(active?.id) {
        while (active != null) {
            now = SystemClock.elapsedRealtime()
            delay(250)
        }
    }

    // 5-1-1 指标统计与评估
    val completedContractions = items.filter { it.endedAt != null && !it.interrupted }
    val lastItem = completedContractions.firstOrNull()
    val lastDurationSec = lastItem?.durationMillis?.let { it / 1000 } ?: 0L

    val secondLastItem = completedContractions.getOrNull(1)
    val lastIntervalSec = if (lastItem != null && secondLastItem != null) {
        ((lastItem.startedAt - secondLastItem.startedAt) / 1000).coerceAtLeast(0)
    } else 0L

    val intervalRatio = if (lastIntervalSec > 0) (300f / lastIntervalSec.toFloat()).coerceIn(0.1f, 1f) else 0.5f
    val durationRatio = (lastDurationSec.toFloat() / 60f).coerceIn(0.1f, 1f)
    val isNear511 = lastIntervalSec in 1..360 && lastDurationSec >= 45

    PregnancyPage(
        title = "临产分诊与应激",
        subtitle = "5-1-1 规律收治法则 · 破水零延迟急救"
    ) {
        // 1. 顶部极端醒目救命警报横幅（破水绝对零延迟干预）
        ClinicalCard(
            backgroundColor = TertiaryContainer,
            borderColor = TertiaryEmergency
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text("⚠️", fontSize = 16.sp)
                    Text(
                        "特例红色警报：疑似胎膜早破",
                        color = Color.White,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold
                    )
                }
                Surface(
                    shape = RoundedCornerShape(9999.dp),
                    color = Color.White
                ) {
                    Text(
                        "先平卧 · 禁淋浴",
                        color = TertiaryEmergency,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                    )
                }
            }

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color.Black.copy(alpha = 0.25f))
                    .padding(8.dp)
            ) {
                Text(
                    "羊水破裂绝不停留 5-1-1 计时！一旦有温热无色液体流出，严禁站立与淋浴。立即就地平卧，臀部垫高 15~20cm，严防脐带脱垂引发胎儿窒息！",
                    color = Color.White,
                    style = MaterialTheme.typography.bodySmall,
                    fontSize = 12.sp,
                    lineHeight = 16.sp
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = onEmergency,
                    colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = TertiaryEmergency),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Text("直拨急救 / 医疗卡", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                }
                OutlinedButton(
                    onClick = { showPostureModal = true },
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Text("抬臀体位图解", fontSize = 12.sp)
                }
            }
        }

        // 2. 5-1-1 黄金收治法则科普与实时度量仪表盘
        ClinicalCard(
            backgroundColor = SurfaceContainerLowest,
            borderColor = SurfaceContainer
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Box(Modifier.size(8.dp).clip(CircleShape).background(Primary))
                    Text("5-1-1 规律宫缩医学准则", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                }
                ClinicalBadge(
                    if (isNear511) "接近临产" else "监测判定中",
                    backgroundColor = if (isNear511) PrimaryFixed else SurfaceContainerHigh,
                    textColor = if (isNear511) OnPrimaryFixedVariant else MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // 三联指标度量仪表
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // 指标 1: 宫缩间隔
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(8.dp))
                        .background(SurfaceContainerLow)
                        .padding(8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("宫缩间隔", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(
                        if (lastIntervalSec > 0) "%02d:%02d".format(lastIntervalSec / 60, lastIntervalSec % 60) else "--:--",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = Primary,
                        fontFamily = FontFamily.Monospace
                    )
                    Text("目标 ≤ 5 分钟", fontSize = 10.sp, color = Success)
                    LinearProgressIndicator(
                        progress = { intervalRatio },
                        modifier = Modifier.fillMaxWidth().height(4.dp).padding(top = 4.dp).clip(RoundedCornerShape(2.dp)),
                        color = Primary,
                        trackColor = SurfaceContainerHighest
                    )
                }

                // 指标 2: 紧绷时长
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(8.dp))
                        .background(SurfaceContainerLow)
                        .padding(8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("紧绷时长", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(
                        if (lastDurationSec > 0) "${lastDurationSec}秒" else "--",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = Primary,
                        fontFamily = FontFamily.Monospace
                    )
                    Text("目标 ≥ 60 秒", fontSize = 10.sp, color = Success)
                    LinearProgressIndicator(
                        progress = { durationRatio },
                        modifier = Modifier.fillMaxWidth().height(4.dp).padding(top = 4.dp).clip(RoundedCornerShape(2.dp)),
                        color = Primary,
                        trackColor = SurfaceContainerHighest
                    )
                }

                // 指标 3: 稳定节律
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(8.dp))
                        .background(SurfaceContainerLow)
                        .padding(8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("有效次数", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(
                        "${completedContractions.take(10).size}次",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = Primary,
                        fontFamily = FontFamily.Monospace
                    )
                    Text("目标持续 ≥ 1小时", fontSize = 10.sp, color = Success)
                    LinearProgressIndicator(
                        progress = { (completedContractions.take(10).size / 10f).coerceIn(0.1f, 1f) },
                        modifier = Modifier.fillMaxWidth().height(4.dp).padding(top = 4.dp).clip(RoundedCornerShape(2.dp)),
                        color = Primary,
                        trackColor = SurfaceContainerHighest
                    )
                }
            }

            // 临床指引状态条
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(PrimaryFixed.copy(alpha = 0.5f))
                    .padding(8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text("💡", fontSize = 14.sp)
                Text(
                    if (isNear511) "强度接近 5-1-1 标准，若阵痛加剧请立即整装送医！初产妇建议保持平稳呼吸。" else "初产妇 5-1-1 标准：每5分钟疼一次，每次疼60秒以上，持续1小时再前往医院。",
                    fontSize = 11.sp,
                    color = OnPrimaryFixedVariant,
                    lineHeight = 15.sp
                )
            }
        }

        // 3. 超大单手触控圆形计时器（阵痛人体工学 220dp）
        ClinicalCard(
            backgroundColor = SurfaceContainerLowest,
            borderColor = SurfaceContainer
        ) {
            Text(
                "阵痛单手计时器 (大按钮防手抖误触)",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 12.dp),
                contentAlignment = Alignment.Center
            ) {
                val currentDurationSec = if (active != null) (now - active.elapsedStart).coerceAtLeast(0) / 1000 else 0L
                val isTiming = active != null

                // 220dp 圆形大按钮
                Box(
                    modifier = Modifier
                        .size(210.dp)
                        .clip(CircleShape)
                        .background(
                            Brush.verticalGradient(
                                if (isTiming) listOf(TertiaryEmergency, TertiaryContainer)
                                else listOf(Color(0xFFB90538), Color(0xFFDC2C4F))
                            )
                        )
                        .clickable(enabled = !busy) {
                            if (active == null) onStart() else onStop()
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text(
                            text = if (isTiming) "阵痛紧绷中 · 点击结束" else "准备就绪 · 发紧请按",
                            color = Color.White.copy(alpha = 0.9f),
                            fontSize = 11.sp
                        )
                        Text(
                            text = "%02d:%02d".format(currentDurationSec / 60, currentDurationSec % 60),
                            color = Color.White,
                            fontSize = 38.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                        Surface(
                            shape = RoundedCornerShape(9999.dp),
                            color = Color.White.copy(alpha = 0.25f)
                        ) {
                            Text(
                                text = if (isTiming) "■ 结束本次阵痛" else "▶ 开始本次阵痛",
                                color = Color.White,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                            )
                        }
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceAround
            ) {
                Text("✓ 自动去噪防误触", fontSize = 11.sp, color = Success)
                Text("•", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("✓ 支持单手盲按", fontSize = 11.sp, color = Primary)
            }
        }

        // 4. 待产包物资与分娩计划书快速查看入口
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            ClinicalCard(
                modifier = Modifier.weight(1f).clickable { showBagModal = true },
                backgroundColor = SurfaceContainerLowest,
                borderColor = SurfaceContainer
            ) {
                Text("🧳 待产包随身查", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                Text("A/B/C类物资清单", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                ClinicalBadge("已备齐 18/20", backgroundColor = SecondaryFixed, textColor = OnSecondaryFixedVariant)
            }
            ClinicalCard(
                modifier = Modifier.weight(1f).clickable { showPlanModal = true },
                backgroundColor = SurfaceContainerLowest,
                borderColor = SurfaceContainer
            ) {
                Text("📝 分娩愿望书", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                Text("无痛偏好/断脐人", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                ClinicalBadge("准爸随带", backgroundColor = PrimaryFixed, textColor = OnPrimaryFixedVariant)
            }
        }

        // 5. 历史记录明细列表
        ClinicalSectionHeader(title = "近期宫缩明细")

        if (items.isEmpty()) {
            EmptyRecords("暂无计时记录。感到发紧腹胀时轻触上方大圆形按钮即可记录。")
        }

        items.forEachIndexed { index, item ->
            val previous = items.getOrNull(index + 1)
            val interval = previous?.takeIf { it.bootCount == item.bootCount && it.bootCount >= 0 }
                ?.let { (item.elapsedStart - it.elapsedStart).takeIf { diff -> diff >= 0 } }

            ClinicalCard(
                backgroundColor = SurfaceContainerLowest,
                borderColor = SurfaceContainer
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                displayTimestamp(item.startedAt),
                                style = MaterialTheme.typography.bodySmall,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Monospace
                            )
                            if (item.interrupted) {
                                ClinicalBadge("中断", backgroundColor = SurfaceContainerHigh, textColor = MaterialTheme.colorScheme.onSurfaceVariant)
                            } else if (item.endedAt == null) {
                                ClinicalBadge("正在记录", backgroundColor = PrimaryFixed, textColor = OnPrimaryFixedVariant, hasPulseDot = true)
                            }
                        }
                        Text(
                            when {
                                item.interrupted -> "计时中断（重启或关怀模式），持续时间未知"
                                item.endedAt == null -> "正在进行中…"
                                else -> "持续 ${durationLabel(item.durationMillis ?: 0)}"
                            } + (interval?.let { " · 距上次 ${durationLabel(it)}" } ?: ""),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    if (item.endedAt != null) {
                        DeleteRecordButton { onDelete(item) }
                    }
                }
            }
        }

        MedicalNotice()
    }

    // 弹窗 1: 抬臀体位图解
    if (showPostureModal) {
        AlertDialog(
            onDismissRequest = { showPostureModal = false },
            title = { Text("防脐带脱垂 · 抬臀平卧指南") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        "⚠️ 为什么不能站立或淋浴？\n胎头未完全衔接入盆时，羊水突然大量流出可能将脐带冲出宫颈口。若脐带受压数分钟即可致胎儿严重缺氧窒息！",
                        color = Danger,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        "准爸爸行动核对表：\n1. 帮妻子在身下垫好护理垫或厚浴巾。\n2. 将两个枕头塞至臀部下方（垫高 15~20cm）。\n3. 拿取随身身份证、医保卡、产检大病历夹。\n4. 拨打 120 明确告知调度员：“孕妇羊水破了，已平卧垫高，急需担架上门转运”。",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        lineHeight = 17.sp
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = { showPostureModal = false }) { Text("我已牢记并就地处置") }
            }
        )
    }

    // 弹窗 2: 待产包清单
    if (showBagModal) {
        AlertDialog(
            onDismissRequest = { showBagModal = false },
            title = { Text("临产即拿 · 随身待产包清单") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("A类：进急诊必交证件（红袋，准爸贴身带）", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Primary)
                    Text("• 双方身份证原件、社保卡/医保卡\n• 产检大本全部化验单与B超单\n• 生育登记服务单复印件", fontSize = 11.sp)

                    Text("B类：进产房随行包（透明袋，产妇进待产室用）", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Primary)
                    Text("• 计量型产妇卫生巾 / 医用刀纸 2 包\n• 大号一次性护理垫 60x90cm\n• 弯头吸管水杯 + 巧克力/能量胶\n• 一次性内裤 + 胎心监护绑带 2 条", fontSize = 11.sp)

                    Text("C类：病房留存包（出产房再取，放车后备箱）", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("• 婴儿初生和服棉衣 2 套、包被 1 条、NB号纸尿裤 1 包、吸奶器", fontSize = 11.sp)
                }
            },
            confirmButton = {
                TextButton(onClick = { showBagModal = false }) { Text("核对完毕") }
            }
        )
    }

    // 弹窗 3: 分娩愿望书
    if (showPlanModal) {
        AlertDialog(
            onDismissRequest = { showPlanModal = false },
            title = { Text("家庭分娩意向书 (EBM 循证规范)") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("• 分娩镇痛意愿：强烈要求无痛麻醉 (开一指即上)", fontSize = 12.sp)
                    Text("• 会阴侧切态度：首选保护会阴，遇紧急胎儿缺氧遵医嘱", fontSize = 12.sp)
                    Text("• 家属陪产与断脐：准爸爸全程陪产 · 亲手剪断脐带", fontSize = 12.sp)
                    Text("• 早接触与早开奶：出生后即刻趴在母亲胸前肌肤接触 30min+", fontSize = 12.sp)
                    Text("* 提示：医疗团队将在保障母婴绝对生命安全的前提下最大程度尊重该愿望清单。突发医学指征请听从主管医生指令。", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            },
            confirmButton = {
                TextButton(onClick = { showPlanModal = false }) { Text("确认意向") }
            }
        )
    }
}
