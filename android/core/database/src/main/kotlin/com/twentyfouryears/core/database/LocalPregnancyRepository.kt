package com.twentyfouryears.core.database

import androidx.room.withTransaction
import com.twentyfouryears.core.domain.*
import com.twentyfouryears.core.model.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.channels.awaitClose
import androidx.room.InvalidationTracker

class LocalPregnancyRepository(private val db: TwentyFourYearsDatabase) : PregnancyRepository {
    private val dao=db.pregnancyDao()
    override val snapshot: Flow<PregnancySnapshot> = callbackFlow {
        val observer=object : InvalidationTracker.Observer("pregnancies","pregnancy_records") {
            override fun onInvalidated(tables: Set<String>) { trySend(Unit) }
        }
        db.invalidationTracker.addObserver(observer)
        trySend(Unit)
        awaitClose { db.invalidationTracker.removeObserver(observer) }
    }.conflate().map { readSnapshot() }
    override suspend fun readSnapshot(): PregnancySnapshot = db.withTransaction {
        val p=dao.profile()
        PregnancyCodec.assemble(p?.let { PregnancyProfile(it.id,it.name,it.dueDate,it.silent,it.hospital,it.contact,it.medicalNotes) },p?.let { dao.records(it.id) } ?: emptyList())
    }
    override suspend fun saveProfile(profile: PregnancyProfile) {
        validateProfile(profile)
        dao.saveProfile(PregnancyEntity(profile.id,profile.name,profile.dueDate,profile.silent,profile.hospital,profile.contact,profile.medicalNotes))
    }
    override suspend fun saveCheckup(checkup: Checkup, expense: LedgerEntry?) = db.withTransaction {
        require(checkup.title.isNotBlank()); validDate(checkup.date)
        dao.saveRecord(PregnancyCodec.record(checkup))
        expense?.let { saveEntry(it) }
        Unit
    }
    override suspend fun saveVital(vital: Vital) { validateVital(vital); dao.saveRecord(PregnancyCodec.record(vital)) }
    override suspend fun saveEntry(entry: LedgerEntry) { require(entry.cents>0 && entry.title.isNotBlank()); validDate(entry.date); dao.saveRecord(PregnancyCodec.record(entry)) }
    override suspend fun saveReminder(reminder: Reminder) { require(reminder.title.isNotBlank()); validTime(reminder.time); dao.saveRecord(PregnancyCodec.record(reminder)) }
    override suspend fun saveContraction(contraction: Contraction) { dao.saveRecord(PregnancyCodec.record(contraction)) }
    override suspend fun deleteRecord(type: String,id: String) = dao.deleteRecord(type,id)
    override suspend fun replaceSnapshot(snapshot: PregnancySnapshot) = db.withTransaction {
        dao.clearProfiles()
        snapshot.profile?.let { saveProfile(it) }
        PregnancyCodec.records(snapshot).forEach { dao.saveRecord(it) }
    }
}
