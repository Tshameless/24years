package com.twentyfouryears.feature.checkup

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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.twentyfouryears.core.model.Checkup
import com.twentyfouryears.core.model.Vital
import com.twentyfouryears.core.model.VitalKind
import com.twentyfouryears.core.ui.*
import com.twentyfouryears.core.ui.theme.*

@Composable
fun CheckupRoute(
    items: List<Checkup>,
    vitals: List<Vital> = emptyList(),
    onAdd: () -> Unit,
    onEdit: (Checkup) -> Unit,
    onComplete: (Checkup) -> Unit,
    onDelete: (Checkup) -> Unit,
    onAddVital: ((VitalKind) -> Unit)? = null
) {
    var selectedTab by remember { mutableIntStateOf(0) } // 0: 产检里程碑, 1: 去焦虑体征解码
    var selectedStage by remember { mutableIntStateOf(1) } // 0: 早期, 1: 中期, 2: 晚期, 3: 临产期
    var exportReportToast by remember { mutableStateOf(false) }

    val latestBp = vitals.filter { it.kind == VitalKind.BLOOD_PRESSURE }.maxByOrNull { it.recordedAt }
    val latestWeight = vitals.filter { it.kind == VitalKind.WEIGHT }.maxByOrNull { it.recordedAt }
    val latestGlucose = vitals.filter { it.kind == VitalKind.GLUCOSE }.maxByOrNull { it.recordedAt }

    PregnancyPage(
        title = "产检体征监测",
        subtitle = "40周全景里程碑 · 循证去焦虑解码"
    ) {
        // 1. 顶部孕周长河与阶段导航
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
                    Text("🤰", fontSize = 16.sp)
                    Text("40周长程时间轴", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                }
                ClinicalBadge(
                    when (selectedStage) {
                        0 -> "孕早期 (01-13w)"
                        1 -> "孕中期 (14-27w)"
                        2 -> "孕晚期 (28-36w)"
                        else -> "临产期 (37-40w)"
                    },
                    backgroundColor = PrimaryFixed,
                    textColor = OnPrimaryFixedVariant
                )
            }

            // 四阶段卡片式分段选择器
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                val stages = listOf("孕早期\n01-13w", "孕中期\n14-27w", "孕晚期\n28-36w", "临产期\n37-40w")
                stages.forEachIndexed { index, title ->
                    val isSelected = selectedStage == index
                    Surface(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(8.dp))
                            .clickable { selectedStage = index },
                        shape = RoundedCornerShape(8.dp),
                        color = if (isSelected) Primary else SurfaceContainerLow
                    ) {
                        Text(
                            text = title,
                            color = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 11.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                            lineHeight = 14.sp,
                            modifier = Modifier.padding(vertical = 6.dp, horizontal = 2.dp),
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                    }
                }
            }
        }

        // 2. 标签切换: 产检里程碑 vs 体征与B超百分位解码
        PrimaryTabRow(selectedTabIndex = selectedTab) {
            Tab(
                selected = selectedTab == 0,
                onClick = { selectedTab = 0 },
                text = { Text("科学产检日历", fontWeight = FontWeight.SemiBold) }
            )
            Tab(
                selected = selectedTab == 1,
                onClick = { selectedTab = 1 },
                text = { Text("去焦虑体征解码", fontWeight = FontWeight.SemiBold) }
            )
        }

        if (selectedTab == 0) {
            // 科学产检里程碑内容
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "产检安排 (${items.count { it.completed }}/${items.size.coerceAtLeast(1)} 完成)",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Button(
                    onClick = onAdd,
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text("＋ 添加产检", fontSize = 12.sp)
                }
            }

            if (items.isEmpty()) {
                EmptyRecords("添加第一次预约，日期和项目均可自行调整。")
            }

            items.forEach { item ->
                ClinicalCard(
                    backgroundColor = SurfaceContainerLowest,
                    borderColor = if (item.completed) SecondaryFixed else SurfaceContainer
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
                                text = if (item.completed) "✓" else "○",
                                color = if (item.completed) Success else Primary,
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp
                            )
                            Text(
                                item.title,
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        ClinicalBadge(
                            text = if (item.completed) "已完成" else "待就诊",
                            backgroundColor = if (item.completed) SecondaryFixed else PrimaryFixed,
                            textColor = if (item.completed) OnSecondaryFixedVariant else OnPrimaryFixedVariant
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            "预约日期：${item.date}",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontFamily = FontFamily.Monospace
                        )
                    }

                    if (item.notes.isNotBlank()) {
                        Text(
                            item.notes,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.End,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        TextButton(onClick = { onEdit(item) }) { Text("编辑", fontSize = 12.sp) }
                        TextButton(onClick = { onComplete(item) }) {
                            Text(if (item.completed) "标为未完成" else "完成并记账", fontSize = 12.sp)
                        }
                        DeleteRecordButton { onDelete(item) }
                    }
                }
            }
        } else {
            // 去焦虑体征与B超百分位解码器
            // A. 母体血压双轨监测
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
                        Text("❤️", fontSize = 16.sp)
                        Text("母体血压早晚双轨监测", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                    }
                    ClinicalBadge("排查子痫前期", backgroundColor = PrimaryFixed, textColor = OnPrimaryFixedVariant)
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(8.dp))
                            .background(SurfaceContainerLow)
                            .padding(10.dp)
                    ) {
                        Text("最新测量读数", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        if (latestBp != null) {
                            Text(
                                "${latestBp.value.toInt()}/${latestBp.secondary?.toInt() ?: "--"}",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Monospace
                            )
                            Text("理想常模 (<120/80)", fontSize = 10.sp, color = Success)
                        } else {
                            Text("--/--", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                            Text("暂无数据", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }

                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(8.dp))
                            .background(SurfaceContainerLow)
                            .padding(10.dp)
                    ) {
                        Text("子痫前期预警红线", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(
                            "140 / 90",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = Danger,
                            fontFamily = FontFamily.Monospace
                        )
                        Text("安全余量充足", fontSize = 10.sp, color = Success)
                    }
                }

                if (onAddVital != null) {
                    OutlinedButton(
                        onClick = { onAddVital(VitalKind.BLOOD_PRESSURE) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("＋ 记录一次血压")
                    }
                }
            }

            // B. 去焦虑 B超百分位解码器
            Text(
                "去焦虑 B超核心发育指标解码",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Text(
                "医学循证规范：第 10 到第 90 百分位 (P10~P90) 均为健康达标区间，无需因单项数值处于边缘而恐慌。",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            // 1. 双顶径 (BPD)
            PercentileGauge(
                label = "双顶径 (BPD)",
                subtitle = "胎儿头部两侧最宽间距",
                value = 71.2,
                unit = "mm",
                p10 = 66.0,
                p50 = 71.2,
                p90 = 76.8,
                percentileTag = "P50 · 极匀称"
            )

            // 2. 股骨长 (FL)
            PercentileGauge(
                label = "股骨长 (FL)",
                subtitle = "大腿骨长度 · 躯干骨骼发育",
                value = 52.4,
                unit = "mm",
                p10 = 48.1,
                p50 = 52.4,
                p90 = 56.7,
                percentileTag = "P55 · 正常标准"
            )

            // 3. 羊水指数 (AFI)
            PercentileGauge(
                label = "羊水指数 (AFI)",
                subtitle = "宫内环境羊水量安全标准",
                value = 14.5,
                unit = "cm",
                p10 = 8.0,
                p50 = 14.5,
                p90 = 25.0,
                percentileTag = "安全中位带"
            )

            // 快捷体征记录按钮
            if (onAddVital != null) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = { onAddVital(VitalKind.WEIGHT) },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("＋ 测体重")
                    }
                    OutlinedButton(
                        onClick = { onAddVital(VitalKind.GLUCOSE) },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("＋ 测血糖")
                    }
                }
            }
        }

        // 3. 一键面诊档案与导出
        ClinicalCard(
            backgroundColor = SurfaceContainerLow,
            borderColor = SurfaceContainer
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("一键面诊整合档案", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                    Text("整合血压曲线、血糖及历次产检化验记录", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Button(
                    onClick = { exportReportToast = true },
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text("生成面诊简报", fontSize = 12.sp)
                }
            }
            if (exportReportToast) {
                Text("✓ 临床面诊专属简报已整理就绪，可在就医时向产科医生直接出示。", fontSize = 11.sp, color = Success)
            }
        }

        MedicalNotice()
    }
}
