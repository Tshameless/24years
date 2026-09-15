package com.twentyfouryears.core.moduleruntime

enum class FeatureModuleId {
    PRECONCEPTION,
    PREGNANCY,
    INFANT_0_1,
}

interface ModuleRuntime {
    fun isInstalled(id: FeatureModuleId): Boolean
    fun isAlwaysOn(id: FeatureModuleId): Boolean
    suspend fun install(id: FeatureModuleId): Result<Unit>
    suspend fun uninstall(id: FeatureModuleId): Result<Unit>
}

/** 0.1.0: pregnancy is compiled into the host; other stage packs are not shipped. */
class AlwaysOnPregnancyModuleRuntime : ModuleRuntime {
    override fun isInstalled(id: FeatureModuleId): Boolean =
        id == FeatureModuleId.PREGNANCY

    override fun isAlwaysOn(id: FeatureModuleId): Boolean =
        id == FeatureModuleId.PREGNANCY

    override suspend fun install(id: FeatureModuleId): Result<Unit> =
        if (isAlwaysOn(id)) {
            Result.success(Unit)
        } else {
            Result.failure(NotImplementedError("Code splits ship in 0.2.0"))
        }

    override suspend fun uninstall(id: FeatureModuleId): Result<Unit> =
        Result.failure(NotImplementedError("Code splits ship in 0.2.0"))
}
