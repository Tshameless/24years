plugins {
    id("twentyfouryears.jvm.library")
}

dependencies {
    implementation(project(":core:model"))
    implementation(project(":core:common"))
    testImplementation(libs.junit)
}
