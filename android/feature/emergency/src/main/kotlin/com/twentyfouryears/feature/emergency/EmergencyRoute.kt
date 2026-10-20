package com.twentyfouryears.feature.emergency

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import com.twentyfouryears.core.model.PregnancyProfile
import com.twentyfouryears.core.ui.*

@Composable
fun EmergencyRoute(profile: PregnancyProfile?,onEdit: ()->Unit,onDial: (String)->Unit) {
    PregnancyPage("离线医疗信息卡","紧急情况请直接联系当地急救服务，不必等待应用计时或判断。") {
        Button(onClick={onDial("120")}){Text("拨打 120（中国大陆）")}
        Text("将在系统拨号界面确认；其他地区请使用当地急救号码。")
        if(profile!=null) {
            RecordCard(profile.name,"预产期：${profile.dueDate} · 医院：${profile.hospital.ifBlank { "未填写" }}")
            RecordCard("过敏 / 用药 / 其他备注",profile.medicalNotes.ifBlank { "未填写，不能视为无过敏或无病史" })
            if(profile.contact.isNotBlank()) OutlinedButton(onClick={onDial(profile.contact)}){Text("联系预留联系人")}
            TextButton(onClick=onEdit){Text("编辑医疗信息")}
        }
        RecordCard("准备向医护说明","当前所在位置、本人联系方式、孕期信息与目前不适。这里的资料由用户填写，未经医疗机构核验。")
        MedicalNotice()
    }
}
