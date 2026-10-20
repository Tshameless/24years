plugins {
    id("twentyfouryears.android.library")
    alias(libs.plugins.ksp)
}

android {
    namespace = "com.twentyfouryears.core.database"
    testOptions { unitTests.isIncludeAndroidResources = true }
}

dependencies {
    implementation(project(":core:model"))
    implementation(project(":core:domain"))
    implementation(libs.room.runtime)
    implementation(libs.room.ktx)
    ksp(libs.room.compiler)
    testImplementation(libs.junit)
    testImplementation("org.json:json:20240303")
    testImplementation("org.robolectric:robolectric:4.14.1")
    testImplementation("androidx.test:core:1.6.1")
}

ksp { arg("room.schemaLocation", "$projectDir/schemas") }
