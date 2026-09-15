pluginManagement {
    includeBuild("build-logic")
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "24years"

include(":app")

include(":core:common")
include(":core:model")
include(":core:domain")
include(":core:module-runtime")
include(":core:database")
include(":core:datastore")
include(":core:network")
include(":core:sync")
include(":core:ui")
include(":core:updater")
include(":core:push")

include(":feature:auth")
include(":feature:onboarding")
include(":feature:home")
include(":feature:checkup")
include(":feature:vitals")
include(":feature:reminders")
include(":feature:ledger")
include(":feature:emergency")
include(":feature:contraction")
include(":feature:silent-care")
include(":feature:content")
