package com.twentyfouryears.app

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.twentyfouryears.core.moduleruntime.AlwaysOnPregnancyModuleRuntime
import com.twentyfouryears.core.moduleruntime.FeatureModuleId
import com.twentyfouryears.core.ui.theme.TwentyFourYearsTheme
import com.twentyfouryears.feature.home.HomeRoute

@Composable
fun TwentyFourYearsRoot() {
    TwentyFourYearsTheme {
        Surface(modifier = Modifier.fillMaxSize()) {
            val modules = AlwaysOnPregnancyModuleRuntime()
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text("24Years", style = MaterialTheme.typography.headlineMedium)
                Text(
                    "Pregnancy module always on: " +
                        modules.isAlwaysOn(FeatureModuleId.PREGNANCY),
                    style = MaterialTheme.typography.bodyMedium,
                )
                HomeRoute()
            }
        }
    }
}
