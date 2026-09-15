plugins {
    id("twentyfouryears.android.library")
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "com.twentyfouryears.core.network"
}

dependencies {
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)
    implementation(libs.kotlinx.serialization.json)
}
