plugins {
    id("twentyfouryears.android.application")
}

android {
    namespace = "com.twentyfouryears.app"
    defaultConfig {
        applicationId = "com.twentyfouryears.app"
        versionCode = 1
        versionName = "0.1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
        debug {
            isMinifyEnabled = false
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation(project(":core:common"))
    implementation(project(":core:model"))
    implementation(project(":core:domain"))
    implementation(project(":core:module-runtime"))
    implementation(project(":core:database"))
    implementation(project(":core:datastore"))
    implementation(project(":core:network"))
    implementation(project(":core:sync"))
    implementation(project(":core:ui"))
    implementation(project(":core:updater"))
    implementation(project(":core:push"))
    implementation(project(":feature:auth"))
    implementation(project(":feature:onboarding"))
    implementation(project(":feature:home"))
    implementation(project(":feature:checkup"))
    implementation(project(":feature:vitals"))
    implementation(project(":feature:reminders"))
    implementation(project(":feature:ledger"))
    implementation(project(":feature:emergency"))
    implementation(project(":feature:contraction"))
    implementation(project(":feature:silent-care"))
    implementation(project(":feature:content"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.material3)
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
}
