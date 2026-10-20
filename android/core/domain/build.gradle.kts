plugins {
    id("twentyfouryears.jvm.library")
}

dependencies {
    implementation(project(":core:model"))
    implementation(project(":core:common"))
    implementation(libs.kotlinx.coroutines.core)
    testImplementation(libs.junit)
}
