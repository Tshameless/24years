package com.twentyfouryears.core.model

enum class FamilyMode { SINGLE, COUPLE }

enum class LifeStage { PRECONCEPTION, PREGNANCY, INFANT_0_1 }

enum class CareState { HEALTHY, SILENT }

enum class FamilyRole { MOM, DAD, SINGLE_PARENT }

data class Family(
    val familyId: String,
    val familyMode: FamilyMode,
    val currentStage: LifeStage,
    val careState: CareState,
)
