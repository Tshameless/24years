package com.twentyfouryears.app

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import java.time.*
import kotlinx.coroutines.sync.withLock

class PregnancyReminderWorker(context: Context,params: WorkerParameters): CoroutineWorker(context,params) {
    override suspend fun doWork(): Result {
        val context=applicationContext
        return try {
            context.pregnancyGraph.mutation.withLock {
                val snapshot=context.pregnancyGraph.repository.readSnapshot()
                val profile=snapshot.profile
                if(profile==null || profile.silent || !NotificationManagerCompat.from(context).areNotificationsEnabled()) return@withLock
                val today=LocalDate.now(); val now=LocalTime.now()
                val prefs=context.getSharedPreferences("notification_delivery",Context.MODE_PRIVATE)
                fun deliver(id: String,time: LocalTime,title: String) {
                    val minutes=Duration.between(time,now).toMinutes()
                    if(minutes !in 0..59) return
                    val key="${profile.id}:$id:$time"
                    if(prefs.getString(key,null)==today.toString()) return
                    val intent=Intent(context,MainActivity::class.java)
                    val open=PendingIntent.getActivity(context,0,intent,PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
                    val notification=NotificationCompat.Builder(context,"daily").setSmallIcon(R.drawable.ic_launcher).setContentTitle(title).setContentText("打开 24Years 查看并记录，具体安排请以医嘱为准。").setContentIntent(open).setAutoCancel(true).setVisibility(NotificationCompat.VISIBILITY_PRIVATE).build()
                    try {
                        context.getSystemService(NotificationManager::class.java).notify(key.hashCode(),notification)
                        prefs.edit().putString(key,today.toString()).apply()
                    } catch (_: SecurityException) { /* User can deny notification permission. */ }
                }
                snapshot.reminders.filter {it.enabled && it.completedDate!=today.toString()}.forEach {deliver(it.id,LocalTime.parse(it.time),"你设置的日常提醒")}
                snapshot.checkups.filter {!it.completed && it.date==today.plusDays(1).toString()}.forEach {deliver(it.id,LocalTime.of(9,0),"明天有一项已登记的预约")}
            }
            Result.success()
        } catch (_: Exception) { Result.retry() }
    }
}
