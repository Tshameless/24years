package com.twentyfouryears.core.database

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

@Dao
interface FamilyDao {
    @Query("SELECT * FROM families LIMIT 1")
    fun observeCurrent(): Flow<FamilyEntity?>

    @Upsert
    suspend fun upsert(entity: FamilyEntity)
}
