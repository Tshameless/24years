package com.twentyfouryears.core.push

/** Vendor-channel placeholder. Do not depend on FCM/GMS. */
interface PushClient {
    fun register(token: String)
}
