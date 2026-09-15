package com.twentyfouryears.core.database

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "families")
data class FamilyEntity(
    @PrimaryKey val familyId: String,
    val familyMode: String,
    val currentStage: String,
    val careState: String,
)
