package com.twentyfouryears.app

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.*
import com.twentyfouryears.core.domain.*
import com.twentyfouryears.core.model.*
import com.twentyfouryears.core.ui.*
import com.twentyfouryears.core.ui.theme.TwentyFourYearsTheme
import com.twentyfouryears.feature.home.HomeRoute
import com.twentyfouryears.feature.onboarding.OnboardingRoute
import com.twentyfouryears.feature.checkup.CheckupRoute
import com.twentyfouryears.feature.vitals.VitalsRoute
import com.twentyfouryears.feature.ledger.LedgerRoute
import com.twentyfouryears.feature.reminders.RemindersRoute
import com.twentyfouryears.feature.emergency.EmergencyRoute
import com.twentyfouryears.feature.contraction.ContractionRoute
import com.twentyfouryears.feature.silentcare.SilentCareRoute
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.util.UUID

private data class Editor(val title: String,val fields: List<InputField>,val save: suspend PregnancyRepository.(Map<String,String>)->Unit)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TwentyFourYearsRoot(vm: PregnancyViewModel = viewModel()) {
    val snapshot by vm.state.collectAsStateWithLifecycle()
    val busy by vm.busy.collectAsStateWithLifecycle()
    val error by vm.error.collectAsStateWithLifecycle()
    val message by vm.message.collectAsStateWithLifecycle()
    val nav=rememberNavController()
    val context=LocalContext.current
    val scope=rememberCoroutineScope()
    var editor by remember {mutableStateOf<Editor?>(null)}
    var restore by remember {mutableStateOf<PregnancySnapshot?>(null)}
    var readingBackup by remember {mutableStateOf(false)}
    val snackbar=remember {SnackbarHostState()}
    val profile=snapshot?.profile
    val exporter=rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")){uri -> if(uri!=null) vm.export(uri)}
    val importer=rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()){uri ->
        if(uri!=null) scope.launch {
            readingBackup=true
            try { restore=vm.readBackup(uri) } catch(_: Exception){vm.reportError("备份读取失败：文件格式、内容或版本不兼容，当前数据未更改。")}
            finally {readingBackup=false}
        }
    }
    val permission=rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()){granted -> if(!granted) vm.reportError("未开启通知权限，仍可在应用内查看提醒和打卡。")}
    fun navigate(route: String) {nav.navigate(route){launchSingleTop=true;popUpTo("home"){saveState=true};restoreState=true}}
    fun openEditor(value: Editor){vm.clearError();editor=value}
    fun editProfile(){
        openEditor(Editor(if(profile==null) "建立孕期档案" else "编辑孕期档案",listOf(
            InputField("name","你的称呼",profile?.name ?: ""),
            InputField("due","医生确认的预产期 YYYY-MM-DD",profile?.dueDate ?: ""),
            InputField("hospital","计划就诊医院（可选）",profile?.hospital ?: ""),
            InputField("contact","联系人电话号码（可选）",profile?.contact ?: ""),
            InputField("notes","过敏 / 用药 / 医疗备注（可选）",profile?.medicalNotes ?: "",multiline=true)
        )) { f ->
            val due=validDate(f.getValue("due"))
            if(profile==null) require(due>=LocalDate.now().minusDays(60) && due<=LocalDate.now().plusDays(300)){"请核对预产期，当前版本用于正在进行的孕期"}
            require(f.getValue("contact").isBlank() || Regex("[+0-9 ()-]{3,30}").matches(f.getValue("contact"))){"请填写有效的联系电话"}
            saveProfile(PregnancyProfile(profile?.id ?: UUID.randomUUID().toString(),f.getValue("name"),due.toString(),profile?.silent ?: false,f.getValue("hospital"),f.getValue("contact"),f.getValue("notes")))
        })
    }
    fun editCheckup(item: Checkup?=null){
        val owner=profile?.id ?: return
        openEditor(Editor(if(item==null) "添加产检" else "编辑产检",listOf(InputField("title","产检项目",item?.title ?: ""),InputField("date","预约日期 YYYY-MM-DD",item?.date ?: LocalDate.now().toString()),InputField("notes","医院 / 结果 / 注意事项",item?.notes ?: "",multiline=true))) {f ->
            require(f.getValue("title").isNotBlank()){"请填写产检项目"}
            saveCheckup(Checkup(item?.id ?: UUID.randomUUID().toString(),owner,f.getValue("title"),validDate(f.getValue("date")).toString(),f.getValue("notes"),item?.completed ?: false))
        })
    }
    fun completeCheckup(item: Checkup){
        if(item.completed){vm.mutate { saveCheckup(item.copy(completed=false)) };return}
        val existing=snapshot?.ledger?.firstOrNull {it.checkupId==item.id}
        openEditor(Editor("完成产检",listOf(InputField("notes","检查结果与备注",item.notes,multiline=true),InputField("amount","现金实付（可留空；不含医保已结算部分）",existing?.let {money(it.cents)} ?: "",numeric=true))) {f ->
            val amount=f.getValue("amount")
            val entry=if(amount.isBlank()) null else LedgerEntry(existing?.id ?: "checkup-expense-"+item.id,item.pregnancyId,item.title+" · 产检实付",EntryKind.EXPENSE,parseAmount(amount),item.date,item.id)
            saveCheckup(item.copy(completed=true,notes=f.getValue("notes")),entry)
        })
    }
    fun addVital(kind: VitalKind){
        val owner=profile?.id ?: return
        val fields=mutableListOf(InputField("value",if(kind==VitalKind.BLOOD_PRESSURE) "收缩压 mmHg" else kind.label+" "+kind.unit,numeric=true))
        if(kind==VitalKind.BLOOD_PRESSURE) fields.add(InputField("secondary","舒张压 mmHg",numeric=true))
        fields.add(InputField("notes",if(kind==VitalKind.MOVEMENT) "计数时间段与备注（不作达标判断）" else "测量情境（如空腹 / 餐后）与备注",multiline=true))
        openEditor(Editor("记录"+kind.label,fields){f ->
            val value=f.getValue("value").toDoubleOrNull() ?: throw IllegalArgumentException("请输入有效数字")
            val secondary=if(kind==VitalKind.BLOOD_PRESSURE) f.getValue("secondary").toDoubleOrNull() ?: throw IllegalArgumentException("请填写舒张压") else null
            saveVital(Vital(UUID.randomUUID().toString(),owner,kind,value,secondary,System.currentTimeMillis(),f.getValue("notes")))
        })
    }
    fun editEntry(kind: EntryKind,item: LedgerEntry?=null){
        val owner=profile?.id ?: return
        openEditor(Editor(kind.label,listOf(InputField("title","项目名称",item?.title ?: ""),InputField("amount","实际金额（元）",item?.let {money(it.cents)} ?: "",numeric=true),InputField("date","实际发生日期 YYYY-MM-DD",item?.date ?: LocalDate.now().toString()))) {f ->
            require(f.getValue("title").isNotBlank()){"请填写项目名称"}
            saveEntry(LedgerEntry(item?.id ?: UUID.randomUUID().toString(),owner,f.getValue("title"),kind,parseAmount(f.getValue("amount")),validDate(f.getValue("date")).toString(),item?.checkupId))
        })
    }
    fun editReminder(item: Reminder?=null){
        val owner=profile?.id ?: return
        openEditor(Editor("每日提醒",listOf(InputField("title","事项与医嘱用法",item?.title ?: ""),InputField("time","每天提醒时间 HH:mm",item?.time ?: "08:00"))) {f ->
            require(f.getValue("title").isNotBlank()){"请填写提醒事项"}
            saveReminder(Reminder(item?.id ?: UUID.randomUUID().toString(),owner,f.getValue("title"),validTime(f.getValue("time")).toString(),item?.enabled ?: true,item?.completedDate))
        })
    }
    LaunchedEffect(message){message?.let {snackbar.showSnackbar(it);vm.clearMessage()}}
    LaunchedEffect(snapshot!=null,profile?.id){if(snapshot!=null) navigate("home")}
    TwentyFourYearsTheme {
        val entry by nav.currentBackStackEntryAsState()
        val route=entry?.destination?.route ?: "home"
        Scaffold(snackbarHost={SnackbarHost(snackbar)},topBar={
            TopAppBar(title={Text("24Years")},actions={TextButton(onClick={navigate("emergency")}){Text("医疗卡")};if(profile!=null)TextButton(onClick={navigate("settings")}){Text("档案")}})
        },bottomBar={if(profile!=null) NavigationBar {
            listOf("home" to "今日","checkup" to "产检","vitals" to "体征","ledger" to "账本","reminders" to "提醒").forEach { (target,label) ->
                NavigationBarItem(selected=route==target,onClick={navigate(target)},icon={Text(label.take(1))},label={Text(label)})
            }
        }}) {padding ->
            Box(Modifier.fillMaxSize().padding(padding)) {
                if(snapshot==null) {Column {CircularProgressIndicator();Text("正在读取本机记录…")}}
                else NavHost(navController=nav,startDestination="home") {
                    composable("home"){if(profile==null) OnboardingRoute(onCreate=::editProfile,onImport={importer.launch(arrayOf("application/json","text/plain","application/octet-stream"))}) else snapshot?.let {HomeRoute(it,::navigate)}}
                    composable("checkup"){CheckupRoute(snapshot!!.checkups,{editCheckup()},::editCheckup,::completeCheckup,{vm.mutate {deleteRecord("checkup",it.id)}})}
                    composable("vitals"){VitalsRoute(snapshot!!.vitals,::addVital,{vm.mutate {deleteRecord("vital",it.id)}})}
                    composable("ledger"){LedgerRoute(snapshot!!.ledger,{editEntry(it)},{editEntry(it.kind,it)},{vm.mutate {deleteRecord("entry",it.id)}})}
                    composable("reminders"){RemindersRoute(snapshot!!.reminders,profile?.silent ?: false,{editReminder()},::editReminder,{vm.mutate {saveReminder(it.copy(enabled=!it.enabled))}},{vm.mutate {saveReminder(it.copy(completedDate=if(it.completedDate==LocalDate.now().toString()) null else LocalDate.now().toString()))}},{vm.mutate {deleteRecord("reminder",it.id)}},{
                        if(Build.VERSION.SDK_INT>=33) permission.launch(Manifest.permission.POST_NOTIFICATIONS)
                        else context.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,context.packageName))
                    })}
                    composable("contraction"){ContractionRoute(snapshot!!.contractions,busy,vm::startContraction,vm::stopContraction,{navigate("emergency")},{vm.mutate {deleteRecord("contraction",it.id)}})}
                    composable("emergency"){EmergencyRoute(profile,::editProfile){phone ->
                        try{context.startActivity(Intent(Intent.ACTION_DIAL,Uri.fromParts("tel",phone,null)))}catch(_: Exception){vm.reportError("此设备没有可用的拨号应用，请用电话联系。")}
                    }}
                    composable("settings"){profile?.let {SilentCareRoute(it,::editProfile,vm::toggleSilent,{if(!busy) exporter.launch("24years-pregnancy-"+LocalDate.now()+".json")},{if(!busy) importer.launch(arrayOf("application/json","text/plain","application/octet-stream"))},vm::erase)}}
                }
                if(busy || readingBackup) LinearProgressIndicator(Modifier.fillMaxWidth())
            }
        }
        editor?.let {form -> RecordForm(form.title,form.fields,busy,error,{editor=null;vm.clearError()}) {values ->vm.mutate(onSuccess={editor=null}) {form.save(this,values)}}}
        if(editor==null && error!=null) AlertDialog(onDismissRequest=vm::clearError,title={Text("请留意")},text={Text(error!!)},confirmButton={TextButton(onClick=vm::clearError){Text("知道了")}})
        restore?.let {backup ->AlertDialog(onDismissRequest={restore=null},title={Text("确认恢复备份？")},text={Text("档案："+backup.profile?.name+"。恢复会替换当前所有孕期记录，进行中的计时将标记为中断。建议先导出当前数据。")},confirmButton={TextButton(enabled=!busy,onClick={vm.restore(backup);restore=null}){Text("替换并恢复")}},dismissButton={TextButton(onClick={restore=null}){Text("取消")}})}
    }
}
