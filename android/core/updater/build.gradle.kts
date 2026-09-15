plugins {
    id("twentyfouryears.android.library")
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "com.twentyfouryears.core.updater"
}

dependencies {
    implementation(project(":core:common"))
    implementation(project(":core:network"))
    implementation(libs.okhttp)
    implementation(libs.kotlinx.serialization.json)
}
