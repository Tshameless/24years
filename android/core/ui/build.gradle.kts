plugins {
    id("twentyfouryears.android.compose")
}

android {
    namespace = "com.twentyfouryears.core.ui"
}

dependencies { implementation(project(":core:model")) }
