package com.twentyfouryears.core.database

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(
    entities = [FamilyEntity::class],
    version = 1,
    exportSchema = false,
)
abstract class TwentyFourYearsDatabase : RoomDatabase() {
    abstract fun familyDao(): FamilyDao
}
