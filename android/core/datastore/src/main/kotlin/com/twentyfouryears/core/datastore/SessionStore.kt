package com.twentyfouryears.core.datastore

import android.content.Context
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore

val Context.sessionDataStore by preferencesDataStore(name = "session")

object SessionKeys {
    val jwt = stringPreferencesKey("jwt")
}
