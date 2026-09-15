package com.twentyfouryears.core.updater

import kotlinx.serialization.Serializable

@Serializable
data class UpdateManifest(
    val versionCode: Int,
    val versionName: String,
    val forceUpdate: Boolean = false,
    val releaseNotes: String = "",
    val apks: List<ApkArtifact> = emptyList(),
)

@Serializable
data class ApkArtifact(
    val abi: String,
    val url: String,
    val sha256: String,
    val sizeBytes: Long,
)
