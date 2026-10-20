package com.twentyfouryears.core.domain

import com.twentyfouryears.core.model.*
import kotlinx.coroutines.flow.Flow

interface PregnancyRepository {
    val snapshot: Flow<PregnancySnapshot>
    suspend fun saveProfile(profile: PregnancyProfile)
    suspend fun saveCheckup(checkup: Checkup, expense: LedgerEntry? = null)
    suspend fun saveVital(vital: Vital)
    suspend fun saveEntry(entry: LedgerEntry)
    suspend fun saveReminder(reminder: Reminder)
    suspend fun saveContraction(contraction: Contraction)
    suspend fun deleteRecord(type: String, id: String)
    suspend fun readSnapshot(): PregnancySnapshot
    suspend fun replaceSnapshot(snapshot: PregnancySnapshot)
}
