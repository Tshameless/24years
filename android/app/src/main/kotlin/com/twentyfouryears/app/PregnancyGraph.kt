package com.twentyfouryears.app

import android.content.Context
import android.app.NotificationChannel
import android.app.NotificationManager
import androidx.room.Room
import androidx.work.*
import com.twentyfouryears.core.database.*
import com.twentyfouryears.core.domain.PregnancyRepository
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.sync.Mutex

class PregnancyGraph(context: Context) {
    val database = Room.databaseBuilder(context.applicationContext,TwentyFourYearsDatabase::class.java,"24years.db")
        .addMigrations(TwentyFourYearsDatabase.MIGRATION_1_2).build()
    val repository: PregnancyRepository = LocalPregnancyRepository(database)
    /** Serialize reminder delivery with silent-care and destructive operations. */
    val mutation = Mutex()
    init {
        val notifications=context.getSystemService(NotificationManager::class.java)
        notifications.createNotificationChannel(NotificationChannel("daily","日常与产检提醒",NotificationManager.IMPORTANCE_DEFAULT))
        notifications.createNotificationChannel(NotificationChannel("timer","正在计时",NotificationManager.IMPORTANCE_LOW))
        WorkManager.getInstance(context).enqueueUniquePeriodicWork("pregnancy-reminders",ExistingPeriodicWorkPolicy.KEEP,PeriodicWorkRequestBuilder<PregnancyReminderWorker>(15,TimeUnit.MINUTES).build())
    }
}

val Context.pregnancyGraph: PregnancyGraph get() = (applicationContext as TwentyFourYearsApp).pregnancyGraph
