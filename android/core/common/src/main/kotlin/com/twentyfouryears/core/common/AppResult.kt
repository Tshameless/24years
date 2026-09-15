package com.twentyfouryears.core.common

sealed class AppResult<out T> {
    data class Ok<T>(val value: T) : AppResult<T>()
    data class Err(val throwable: Throwable) : AppResult<Nothing>()
}
