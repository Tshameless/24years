package com.twentyfouryears.core.network

import kotlinx.serialization.json.Json

val NetworkJson = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
}
