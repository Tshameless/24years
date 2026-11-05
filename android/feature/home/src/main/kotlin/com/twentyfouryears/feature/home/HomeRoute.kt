package com.twentyfouryears.feature.home

import androidx.compose.animation.AnimatedVisibility
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
import com.twentyfouryears.core.domain.*
import com.twentyfouryears.core.model.*
import com.twentyfouryears.core.ui.*
import com.twentyfouryears.core.ui.theme.*
import java.time.LocalDate

@Composable
fun HomeRoute(
    snapshot: PregnancySnapshot,
    onNavigate: (String) -> Unit,
    onQuickRecordKick: () -> Unit = {},
    onToggleReminder: (Reminder) -> Unit = {}
) {
    val p = snapshot.profile ?: return
    val today = LocalDate.now()

    if (p.silent) {
        PregnancyPage("给自己一点时间", "已暂停孕期日常与产检提醒。历史记录保存在这里。") {
            ClinicalCard {
                Text("按自己的节奏恢复", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Text("此模式不删除历史资料。你可以查看记录、导出备份，或在准备好时恢复提醒。", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                TextButton(onClick = { onNavigate("settings") }) { Text("档案与关怀设置") }
            }
            ClinicalCard {
                Text("孕期现金净流出", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Text("¥${money(netCashOutflow(snapshot.ledger))} · 已付现金减后续报销与津贴到账", style = MaterialTheme.typography.bodyMedium)
                TextButton(onClick = { onNavigate("ledger") }) { Text("打开账本") }
            }
            OutlinedButton(onClick = { onNavigate("emergency") }, modifier = Modifier.fillMaxWidth()) {
                Text("离线医疗急救卡")
            }
            MedicalNotice()
        }
        return
    }

    val age = gestation(LocalDate.parse(p.dueDate), today)
    val todayStartMillis = today.atStartOfDay(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli()
    val todayKicks = snapshot.vitals.count { it.kind == VitalKind.MOVEMENT && it.recordedAt >= todayStartMillis }
    val latestBp = snapshot.vitals.filter { it.kind == VitalKind.BLOOD_PRESSURE }.maxByOrNull { it.recordedAt }
    val nextCheckup = snapshot.checkups.firstOrNull { !it.completed && it.date >= today.toString() }

    var fatherMassageDone by remember { mutableStateOf(false) }
    var showEbmGuide by remember { mutableStateOf(false) }

    PregnancyPage(
        title = "今日陪伴",
        subtitle = "双人同频成长 · 科学循证守护"
    ) {
        // 1. 顶部孕周长河与双人同频状态卡片 (Level 1 Ambient Precision)
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
                    ClinicalBadge(
                        text = "孕${age.weeks}周+${age.days}天",
                        backgroundColor = PrimaryFixed,
                        textColor = OnPrimaryFixedVariant
                    )
                    ClinicalBadge(
                        text = if (age.daysUntilDue >= 0) "距预产期 ${age.daysUntilDue} 天" else "已超预产期 ${-age.daysUntilDue} 天",
                        backgroundColor = SurfaceContainerHigh,
                        textColor = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                ClinicalBadge(
                    text = if (age.weeks >= 37) "足月待产" else if (age.weeks >= 28) "晚期平稳" else "低危平稳期",
                    backgroundColor = SecondaryFixed,
                    textColor = OnSecondaryFixedVariant,
                    hasPulseDot = true,
                    dotColor = Success
                )
            }

            // 双人同频在线横幅
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // 双人头像重叠效果
                    Row {
                        Box(
                            modifier = Modifier
                                .size(30.dp)
                                .clip(CircleShape)
                                .background(Success),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("爸", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                        Box(
                            modifier = Modifier
                                .offset(x = (-8).dp)
                                .size(30.dp)
                                .clip(CircleShape)
                                .background(Primary),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(p.name.take(1), color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                    Column(modifier = Modifier.offset(x = (-4).dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Text(
                                "${p.name} & 准爸",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold
                            )
                            Box(
                                Modifier
                                    .size(6.dp)
                                    .clip(CircleShape)
                                    .background(Success)
                            )
                        }
                        Text(
                            "协同在线 · 共享最新医学台账",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 11.sp
                        )
                    }
                }
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(
                        "本机离线同频",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }
        }

        // 2. 胎动秒记大胶囊按钮与循证反馈 (Hero Pill)
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
                    Text(
                        "胎动自主监测",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                }
                ClinicalBadge("国际临床循证医学标准", backgroundColor = SurfaceContainer, textColor = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            // 胎动主交互大胶囊
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(
                        Brush.horizontalGradient(
                            listOf(Color(0xFFB90538), Color(0xFFDC2C4F))
                        )
                    )
                    .clickable { onQuickRecordKick() }
                    .padding(horizontal = 16.dp, vertical = 14.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(Color.White.copy(alpha = 0.2f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("👣", fontSize = 18.sp)
                        }
                        Column {
                            Text(
                                "轻触录入 1 次胎动",
                                color = Color.White,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                "快速记录 · 即时同步伴侣医学台账",
                                color = Color.White.copy(alpha = 0.9f),
                                fontSize = 11.sp
                            )
                        }
                    }
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = Color.White.copy(alpha = 0.25f)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.Bottom,
                            horizontalArrangement = Arrangement.spacedBy(3.dp)
                        ) {
                            Text("今日已记", color = Color.White.copy(alpha = 0.85f), fontSize = 11.sp)
                            Text(
                                text = todayKicks.toString(),
                                color = Color.White,
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Monospace
                            )
                            Text("次", color = Color.White.copy(alpha = 0.85f), fontSize = 11.sp)
                        }
                    }
                }
            }

            // 循证指引折叠/展开
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { showEbmGuide = !showEbmGuide },
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    if (showEbmGuide) "收起胎动规范 ▲" else "查看科学胎动定义与计数规范 ▼",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary
                )
            }

            AnimatedVisibility(visible = showEbmGuide) {
                EbmGuideBox(
                    title = "科学胎动定义与计数规范",
                    items = listOf(
                        "核心定义" to "胎儿在子宫内伸手、踢腿或翻滚为 1 次有效胎动。打嗝样微颤不单列计次。",
                        "连动合并" to "连续发生的一连串动作算 1 次，两次动作间隔 3~5 分钟以上方计下一次。",
                        "达标指引" to "餐后静坐或左侧卧计数 1 小时（通常 ≥3~5 次）；或 2 小时内感知胎动 ≥10 次即为正常平稳。"
                    ),
                    warning = "若 12 小时胎动 <10 次或较平日减少 50% 须立即就医。"
                )
            }

            // 循证医学状态反馈
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(SecondaryFixed.copy(alpha = 0.35f))
                    .padding(10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text("✓", color = Success, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        if (todayKicks >= 10) "活跃律动达标 (平稳)" else "规律监测进行中 (今日 $todayKicks 次)",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                        color = OnSecondaryFixedVariant
                    )
                    Text(
                        "临床循证指引：2小时内感知胎动 ≥ 10次即为健康基线，无宫内窘迫风险，继续保持放松心态。",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 11.sp
                    )
                }
            }
        }

        // 3. 今日双向协作打卡瀑布流 (Dual-Actor Accountability)
        ClinicalSectionHeader(
            title = "今日双向协作打卡",
            badgeText = "${snapshot.reminders.count { it.completedDate == today.toString() }}/${snapshot.reminders.size.coerceAtLeast(1)} 协同闭环",
            trailingText = "管理提醒",
            onTrailingClick = { onNavigate("reminders") }
        )

        // 准妈行动 1: 早起晨坐血压监测
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
                    DualActorBadge("准妈行动", isMom = true)
                    Text("早起晨坐血压监测", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                }
                if (latestBp != null) {
                    ClinicalBadge("已达标", backgroundColor = SecondaryFixed, textColor = OnSecondaryFixedVariant)
                } else {
                    ClinicalBadge("待记录", backgroundColor = PrimaryFixed, textColor = OnPrimaryFixedVariant)
                }
            }

            if (latestBp != null) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(SurfaceContainerLow)
                        .padding(10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Row(verticalAlignment = Alignment.Bottom) {
                            Text(
                                "${latestBp.value.toInt()} / ${latestBp.secondary?.toInt() ?: "--"}",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Monospace
                            )
                            Text(" mmHg", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Text("坐姿静息测量 · 无子痫前期倾向", style = MaterialTheme.typography.bodySmall, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Text(displayTimestamp(latestBp.recordedAt), fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, fontFamily = FontFamily.Monospace)
                }
            } else {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("早晨坐姿静息 5 分钟测量，排查子痫前期红线", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    TextButton(onClick = { onNavigate("vitals") }) { Text("录入血压") }
                }
            }
        }

        // 准妈行动 2: 自定义日常提醒列表打卡
        snapshot.reminders.filter { it.enabled }.take(2).forEach { reminder ->
            val isCompleted = reminder.completedDate == today.toString()
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
                        DualActorBadge("准妈行动", isMom = true)
                        Text(reminder.title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                    }
                    ClinicalBadge(
                        if (isCompleted) "已打卡" else "${reminder.time} 提醒",
                        backgroundColor = if (isCompleted) SecondaryFixed else SurfaceContainerHigh,
                        textColor = if (isCompleted) OnSecondaryFixedVariant else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        if (isCompleted) "今日已按医嘱完成" else "餐后或规定时间执行，伴侣将同步同频状态",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    OutlinedButton(
                        onClick = { onToggleReminder(reminder) },
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(if (isCompleted) "取消打卡" else "立即打卡")
                    }
                }
            }
        }

        // 准爸核心担当 1: 检查单与产检物资
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
                    DualActorBadge("准爸核心担当", isMom = false)
                    Text("核对周三产检单据", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                }
                ClinicalBadge("已备齐", backgroundColor = SecondaryFixed, textColor = OnSecondaryFixedVariant)
            }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(SurfaceContainerLow)
                    .padding(10.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("📋", fontSize = 18.sp)
                Column {
                    Text("母子健康手册 + 采血管条形码", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold)
                    Text("已收纳于产检专用文件袋 A-02 格内", style = MaterialTheme.typography.bodySmall, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }

        // 准爸专属责任 2: 睡前低频抚触与拉玛泽呼吸
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
                    DualActorBadge("准爸专属责任", isMom = false)
                    Text("睡前低频抚触 & 呼唤", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                }
                ClinicalBadge(
                    if (fatherMassageDone) "已完成打卡" else "今晚待进行",
                    backgroundColor = if (fatherMassageDone) SecondaryFixed else PrimaryFixed,
                    textColor = if (fatherMassageDone) OnSecondaryFixedVariant else OnPrimaryFixedVariant
                )
            }
            Text(
                "21:30 - 21:50 伴侣指尖环形抚触腹壁，低音朗读，刺激胎儿前庭觉与神经突触发育。",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = { fatherMassageDone = !fatherMassageDone },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (fatherMassageDone) SecondaryFixed else SurfaceContainerHigh,
                        contentColor = if (fatherMassageDone) OnSecondaryFixedVariant else MaterialTheme.colorScheme.onSurface
                    )
                ) {
                    Text(if (fatherMassageDone) "准爸已打卡 · 伴侣可见" else "执行抚触打卡")
                }
            }
        }

        // 4. 下次产检倒计时卡片 (Level 2 临床精准检查指南)
        ClinicalCard(
            backgroundColor = SurfaceContainerLowest,
            borderColor = SurfaceContainer
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        ClinicalBadge("重点产检", backgroundColor = Primary, textColor = Color.White)
                        Text(
                            nextCheckup?.title ?: "按医生安排添加下一次产检",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Text(
                        nextCheckup?.notes?.ifBlank { null } ?: "四维彩色超声 · 糖耐量 OGTT 复核 · 骨盆测量",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
                if (nextCheckup != null) {
                    Column(horizontalAlignment = Alignment.End) {
                        val days = java.time.temporal.ChronoUnit.DAYS.between(today, LocalDate.parse(nextCheckup.date))
                        Text(
                            "$days",
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Bold,
                            color = Primary,
                            fontFamily = FontFamily.Monospace
                        )
                        Text("天后就诊", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }

            // 严谨就诊准备清单
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(SurfaceContainerLow)
                    .padding(10.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text("临床就诊严格准备清单：", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("• 前晚 22:00 起禁食水 8 小时", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("• 备好 300ml 温水刻度杯", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("• 自备采血后高能点心", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("• 双方身份证与产检大本", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    p.hospital.ifBlank { "计划就诊三甲妇产专科医院" },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                TextButton(onClick = { onNavigate("checkup") }) {
                    Text("查看产检日历")
                }
            }
        }

        // 5. 底部双胶囊: 家庭孕期账本 + 24年时光胶囊
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            // 账本卡片
            ClinicalCard(
                modifier = Modifier.weight(1f),
                backgroundColor = SurfaceContainerLowest,
                borderColor = SurfaceContainer
            ) {
                Text("家庭孕期账本", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(
                    "¥ ${money(netCashOutflow(snapshot.ledger))}",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace
                )
                Text("真实净支出流出", fontSize = 10.sp, color = Success)
                TextButton(onClick = { onNavigate("ledger") }, modifier = Modifier.align(Alignment.End)) {
                    Text("记一笔", fontSize = 12.sp)
                }
            }

            // 24年时光胶囊
            ClinicalCard(
                modifier = Modifier.weight(1f),
                backgroundColor = SurfaceContainerLowest,
                borderColor = SurfaceContainer
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("24年时光胶囊", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Box(Modifier.size(6.dp).clip(CircleShape).background(Primary))
                }
                Text("录入此刻心声", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                Text("记录给未来孩子的留言", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                TextButton(onClick = { onNavigate("emergency") }, modifier = Modifier.align(Alignment.End)) {
                    Text("医疗备忘", fontSize = 12.sp)
                }
            }
        }

        // 6. 临产应急与宫缩计时器快捷入口
        OutlinedButton(
            onClick = { onNavigate("contraction") },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text("⏱️ 5-1-1 规律宫缩计时器与破水急救指引")
        }

        MedicalNotice()
    }
}
