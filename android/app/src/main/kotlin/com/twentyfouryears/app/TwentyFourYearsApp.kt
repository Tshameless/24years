package com.twentyfouryears.app

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class TwentyFourYearsApp : Application() {
    val pregnancyGraph: PregnancyGraph by lazy { PregnancyGraph(this) }
}
