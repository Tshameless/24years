package com.twentyfouryears.app

import android.app.Application
import android.app.NotificationManager
import android.content.Intent
import android.net.Uri
import android.os.SystemClock
import android.provider.Settings
import androidx.core.content.ContextCompat
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.twentyfouryears.core.model.*
import com.twentyfouryears.core.domain.*
import com.twentyfouryears.core.database.PregnancyCodec
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.sync.withLock

class PregnancyViewModel(app: Application): AndroidViewModel(app) {
    private val graph=app.pregnancyGraph
    private val repository=graph.repository
    private val _state=MutableStateFlow<PregnancySnapshot?>(null)
    val state=_state.asStateFlow()
    private val _busy=MutableStateFlow(false)
    val busy=_busy.asStateFlow()
    private val _error=MutableStateFlow<String?>(null)
    val error=_error.asStateFlow()
    private val _message=MutableStateFlow<String?>(null)
    val message=_message.asStateFlow()
    init {
        viewModelScope.launch {
            try {
                withContext(Dispatchers.IO) {graph.mutation.withLock {
                    val boot=Settings.Global.getInt(app.contentResolver,Settings.Global.BOOT_COUNT,-1)
                    repository.readSnapshot().contractions.filter {it.endedAt==null && (it.bootCount!=boot || SystemClock.elapsedRealtime()<it.elapsedStart)}.forEach {repository.saveContraction(it.copy(endedAt=System.currentTimeMillis(),durationMillis=null,interrupted=true))}
                }}
                repository.snapshot.flowOn(Dispatchers.IO).collect {_state.value=it}
            } catch (_: Exception) {_error.value="读取本机记录失败，请关闭并重新打开应用。现有记录未被清除。"}
        }
    }
    fun clearError(){_error.value=null}
    fun clearMessage(){_message.value=null}
    fun reportError(message: String){_error.value=message}
    fun mutate(onSuccess: ()->Unit = {}, block: suspend PregnancyRepository.()->Unit) {
        if(_busy.value) return
        _busy.value=true;_error.value=null
        viewModelScope.launch {
            try {
                withContext(Dispatchers.IO) {graph.mutation.withLock {repository.block();_state.value=repository.readSnapshot()}}
                onSuccess()
            } catch(e: Exception) {_error.value=if(e is IllegalArgumentException) e.message ?: "输入有误，请检查" else "保存失败，原有记录仍保留，请重试。"}
            finally {_busy.value=false}
        }
    }
    fun toggleSilent() = mutate {
        val p=readSnapshot().profile ?: return@mutate
        saveProfile(p.copy(silent=!p.silent))
        if(!p.silent) {
            val app=getApplication<Application>()
            readSnapshot().contractions.firstOrNull {it.endedAt==null}?.let {
                saveContraction(it.copy(endedAt=System.currentTimeMillis(),durationMillis=null,interrupted=true))
            }
            app.stopService(Intent(app,ContractionService::class.java))
            app.getSystemService(NotificationManager::class.java).cancelAll()
        }
    }
    fun erase() = mutate {
        replaceSnapshot(PregnancySnapshot())
        getApplication<Application>().stopService(Intent(getApplication(),ContractionService::class.java))
        getApplication<Application>().getSystemService(NotificationManager::class.java).cancelAll()
        getApplication<Application>().getSharedPreferences("notification_delivery",0).edit().clear().apply()
    }
    fun startContraction() = mutate {
        val s=readSnapshot();val p=s.profile ?: return@mutate
        if(s.contractions.any {it.endedAt==null}) return@mutate
        val app=getApplication<Application>()
        val now=System.currentTimeMillis()
        val record=Contraction(java.util.UUID.randomUUID().toString(),p.id,now,elapsedStart=SystemClock.elapsedRealtime(),bootCount=Settings.Global.getInt(app.contentResolver,Settings.Global.BOOT_COUNT,-1))
        saveContraction(record)
        try {ContextCompat.startForegroundService(app,Intent(app,ContractionService::class.java))}
        catch(e: Exception) {saveContraction(record.copy(endedAt=now,interrupted=true));throw e}
    }
    fun stopContraction() = mutate {
        val active=readSnapshot().contractions.firstOrNull {it.endedAt==null} ?: return@mutate
        val boot=Settings.Global.getInt(getApplication<Application>().contentResolver,Settings.Global.BOOT_COUNT,-1)
        val interrupted=active.bootCount!=boot || SystemClock.elapsedRealtime()<active.elapsedStart
        saveContraction(active.copy(endedAt=System.currentTimeMillis(),durationMillis=if(interrupted) null else SystemClock.elapsedRealtime()-active.elapsedStart,interrupted=interrupted))
        getApplication<Application>().stopService(Intent(getApplication(),ContractionService::class.java))
    }
    fun export(uri: Uri) {
        if(_busy.value)return
        _busy.value=true
        viewModelScope.launch {
            try {withContext(Dispatchers.IO) {
                val text=PregnancyCodec.export(repository.readSnapshot())
                requireNotNull(getApplication<Application>().contentResolver.openOutputStream(uri,"wt")) {"无法打开备份文件"}.bufferedWriter(Charsets.UTF_8).use {it.write(text)}
            };_message.value="备份已导出，请妥善保管包含健康信息的文件。"}
            catch(_: Exception){_error.value="备份写入失败，请换一个保存位置重试。"}
            finally{_busy.value=false}
        }
    }
    suspend fun readBackup(uri: Uri): PregnancySnapshot = withContext(Dispatchers.IO) {
        val input=requireNotNull(getApplication<Application>().contentResolver.openInputStream(uri))
        val bytes=input.use {it.readBytesLimited(10*1024*1024)}
        PregnancyCodec.import(bytes.toString(Charsets.UTF_8))
    }
    fun restore(snapshot: PregnancySnapshot) = mutate {
        replaceSnapshot(snapshot)
        val app=getApplication<Application>()
        app.stopService(Intent(app,ContractionService::class.java))
        app.getSystemService(NotificationManager::class.java).cancelAll()
        app.getSharedPreferences("notification_delivery",0).edit().clear().apply()
        _message.value="备份已恢复"
    }
}

private fun java.io.InputStream.readBytesLimited(limit: Int): ByteArray {
    val output=java.io.ByteArrayOutputStream();val buffer=ByteArray(8192)
    while(true){val count=read(buffer);if(count<0)break;require(output.size()+count<=limit){"备份文件超过 10 MB"};output.write(buffer,0,count)}
    return output.toByteArray()
}
