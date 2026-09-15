plugins {
    id("twentyfouryears.android.library")
}

android {
    namespace = "com.twentyfouryears.core.datastore"
}

dependencies {
    implementation(libs.androidx.datastore.preferences)
    implementation(libs.kotlinx.coroutines.android)
}
