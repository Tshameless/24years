package com.twentyfouryears.core.database

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [FamilyEntity::class, PregnancyEntity::class, PregnancyRecordEntity::class],
    version = 2,
    exportSchema = true,
)
abstract class TwentyFourYearsDatabase : RoomDatabase() {
    abstract fun familyDao(): FamilyDao
    abstract fun pregnancyDao(): PregnancyDao

    companion object {
        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("CREATE TABLE IF NOT EXISTS `pregnancies` (`id` TEXT NOT NULL, `name` TEXT NOT NULL, `dueDate` TEXT NOT NULL, `silent` INTEGER NOT NULL, `hospital` TEXT NOT NULL, `contact` TEXT NOT NULL, `medicalNotes` TEXT NOT NULL, PRIMARY KEY(`id`))")
                db.execSQL("CREATE TABLE IF NOT EXISTS `pregnancy_records` (`id` TEXT NOT NULL, `pregnancyId` TEXT NOT NULL, `type` TEXT NOT NULL, `payload` TEXT NOT NULL, PRIMARY KEY(`id`), FOREIGN KEY(`pregnancyId`) REFERENCES `pregnancies`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_pregnancy_records_pregnancyId` ON `pregnancy_records` (`pregnancyId`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_pregnancy_records_type_pregnancyId` ON `pregnancy_records` (`type`, `pregnancyId`)")
            }
        }
    }
}
