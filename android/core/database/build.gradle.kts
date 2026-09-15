plugins {
    id("twentyfouryears.android.library")
    alias(libs.plugins.ksp)
}

android {
    namespace = "com.twentyfouryears.core.database"
}

dependencies {
    implementation(project(":core:model"))
    implementation(libs.room.runtime)
    implementation(libs.room.ktx)
    ksp(libs.room.compiler)
}
