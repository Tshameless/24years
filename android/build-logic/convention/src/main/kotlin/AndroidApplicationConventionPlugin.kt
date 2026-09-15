import com.android.build.api.dsl.ApplicationExtension
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.configure
import org.gradle.kotlin.dsl.withType
import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

class AndroidApplicationConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            pluginManager.apply("com.android.application")
            pluginManager.apply("org.jetbrains.kotlin.android")
            pluginManager.apply("org.jetbrains.kotlin.plugin.compose")
            pluginManager.apply("com.google.dagger.hilt.android")
            pluginManager.apply("com.google.devtools.ksp")
            extensions.configure<ApplicationExtension> {
                compileSdk = TwentyFourYearsConfig.COMPILE_SDK
                defaultConfig {
                    minSdk = TwentyFourYearsConfig.MIN_SDK
                    targetSdk = TwentyFourYearsConfig.TARGET_SDK
                }
                compileOptions {
                    sourceCompatibility = TwentyFourYearsConfig.JAVA
                    targetCompatibility = TwentyFourYearsConfig.JAVA
                }
                buildFeatures {
                    compose = true
                }
            }
            tasks.withType<KotlinCompile>().configureEach {
                compilerOptions {
                    jvmTarget.set(JvmTarget.JVM_17)
                }
            }
        }
    }
}
