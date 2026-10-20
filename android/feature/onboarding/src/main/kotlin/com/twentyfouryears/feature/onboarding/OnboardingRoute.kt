package com.twentyfouryears.feature.onboarding

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import com.twentyfouryears.core.ui.*

@Composable
fun OnboardingRoute(onCreate: ()->Unit,onImport: ()->Unit) {
    PregnancyPage("24Years · 孕期陪伴","从今天的一次记录开始。") {
        RecordCard("为这一段旅程建档","保存产检安排、体征和账单。无需注册，当前版本离线使用，数据仅保存在本机。")
        RecordCard("你的数据由你保管","卸载应用或更换手机前，请在档案页导出备份。导出的文件包含个人健康信息，请妥善保存。")
        Button(onClick=onCreate){Text("建立孕期档案")}
        OutlinedButton(onClick=onImport){Text("从备份恢复")}
        MedicalNotice()
    }
}
