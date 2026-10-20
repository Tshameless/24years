package com.twentyfouryears.app

import android.app.*
import android.content.Intent
import android.os.IBinder
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.withLock

class ContractionService: Service() {
    private val scope=CoroutineScope(SupervisorJob()+Dispatchers.IO)
    override fun onBind(intent: Intent?): IBinder? = null
    override fun onStartCommand(intent: Intent?,flags: Int,startId: Int): Int {
        val open=PendingIntent.getActivity(this,11,Intent(this,MainActivity::class.java),PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val stop=PendingIntent.getService(this,12,Intent(this,ContractionService::class.java).setAction("STOP"),PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        startForeground(7001,NotificationCompat.Builder(this,"timer").setSmallIcon(R.drawable.ic_launcher).setContentTitle("本次计时进行中").setContentText("结束后请点击停止。打开应用查看记录。").setContentIntent(open).addAction(0,"停止计时",stop).setOngoing(true).setVisibility(NotificationCompat.VISIBILITY_PRIVATE).build())
        if(intent?.action=="STOP") scope.launch {
            try {
            pregnancyGraph.mutation.withLock {
                val repo=pregnancyGraph.repository
                repo.readSnapshot().contractions.firstOrNull {it.endedAt==null}?.let {
                    val boot=android.provider.Settings.Global.getInt(contentResolver,android.provider.Settings.Global.BOOT_COUNT,-1)
                    val interrupted=boot!=it.bootCount || SystemClock.elapsedRealtime()<it.elapsedStart
                    repo.saveContraction(it.copy(endedAt=System.currentTimeMillis(),durationMillis=if(interrupted) null else SystemClock.elapsedRealtime()-it.elapsedStart,interrupted=interrupted))
                }
            }
            stopForeground(STOP_FOREGROUND_REMOVE);stopSelf()
            } catch (_: Exception) {
                // Keep the ongoing notification available so the user can retry.
            }
        }
        return START_NOT_STICKY
    }
    override fun onDestroy() {scope.cancel();super.onDestroy()}
}
