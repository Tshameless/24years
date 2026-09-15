package com.twentyfouryears.app.di

import com.twentyfouryears.core.moduleruntime.AlwaysOnPregnancyModuleRuntime
import com.twentyfouryears.core.moduleruntime.ModuleRuntime
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object ModuleRuntimeModule {
    @Provides
    @Singleton
    fun provideModuleRuntime(): ModuleRuntime = AlwaysOnPregnancyModuleRuntime()
}
