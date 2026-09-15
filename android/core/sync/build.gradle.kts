plugins {
    id("twentyfouryears.android.library")
}

android {
    namespace = "com.twentyfouryears.core.sync"
}

dependencies {
    implementation(project(":core:common"))
    implementation(project(":core:database"))
    implementation(project(":core:network"))
    implementation(libs.kotlinx.coroutines.android)
}
