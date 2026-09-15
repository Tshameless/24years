package com.twentyfouryears.core.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
    primary = Primary,
    onPrimary = Color.White,
    primaryContainer = PrimaryLight,
    onPrimaryContainer = Title,
    secondary = Success,
    onSecondary = Color.White,
    error = Danger,
    onError = Color.White,
    errorContainer = DangerLight,
    background = Canvas,
    onBackground = Title,
    surface = Color.White,
    onSurface = Title,
    onSurfaceVariant = Body,
    outline = Divider,
)

private val OledColors = darkColorScheme(
    primary = Primary,
    onPrimary = Color.White,
    primaryContainer = PrimaryDark,
    onPrimaryContainer = OnDark,
    secondary = Success,
    onSecondary = Color.White,
    error = Danger,
    onError = Color.White,
    background = OledBlack,
    onBackground = OnDark,
    surface = CardDark,
    onSurface = OnDark,
    onSurfaceVariant = OnDarkMuted,
    outline = Color(0xFF2A2F3A),
)

@Composable
fun TwentyFourYearsTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) OledColors else LightColors,
        content = content,
    )
}
