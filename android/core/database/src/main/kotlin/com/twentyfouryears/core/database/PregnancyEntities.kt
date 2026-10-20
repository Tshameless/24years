package com.twentyfouryears.core.database

import androidx.room.*

@Entity(tableName = "pregnancies")
data class PregnancyEntity(@PrimaryKey val id: String, val name: String, val dueDate: String, val silent: Boolean, val hospital: String, val contact: String, val medicalNotes: String)

/** Records belong to a pregnancy, independently of household lifecycle state. */
@Entity(tableName = "pregnancy_records",
    foreignKeys = [ForeignKey(entity = PregnancyEntity::class, parentColumns = ["id"], childColumns = ["pregnancyId"], onDelete = ForeignKey.CASCADE)],
    indices = [Index("pregnancyId"), Index(value = ["type", "pregnancyId"])])
data class PregnancyRecordEntity(@PrimaryKey val id: String, val pregnancyId: String, val type: String, val payload: String)

@Dao
interface PregnancyDao {
    @Query("SELECT * FROM pregnancies ORDER BY rowid DESC LIMIT 1")
    suspend fun profile(): PregnancyEntity?
    @Query("SELECT * FROM pregnancy_records WHERE pregnancyId = :pregnancyId")
    suspend fun records(pregnancyId: String): List<PregnancyRecordEntity>
    @Upsert suspend fun saveProfile(profile: PregnancyEntity)
    @Upsert suspend fun saveRecord(record: PregnancyRecordEntity)
    @Query("DELETE FROM pregnancy_records WHERE type = :type AND id = :id")
    suspend fun deleteRecord(type: String, id: String)
    @Query("DELETE FROM pregnancies") suspend fun clearProfiles()
}
